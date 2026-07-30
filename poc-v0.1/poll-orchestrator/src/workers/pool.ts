import { listNewFiles, readFromSource, writeToLanding } from '@sentinel/storage-core'
import type { FileDescriptor } from '@sentinel/storage-core'
import pLimit from 'p-limit'
import { Readable } from 'stream'
import { config } from '../config'
import { getConsumer, type PollJobMessage } from '../kafka'
import { IngestionChannelRepository } from '../repositories/ingestionChannel.repository'
import { IngestionLogRepository } from '../repositories/ingestionLog.repository'
import { getRedisClient } from '../redis'
import { decryptText } from '../utils/crypto'
import { buildDedupKey, type PipelineSource } from '../utils/dedupKey'
import { vaultClient, type VaultSecretListItem } from '../utils/vault-client'

const WORKER_GROUP_ID = 'poll-orchestrator-workers'
const EMAIL_SOURCE_CHANNEL = 'EMAIL_INGESTION'

const ingestionChannelRepository = new IngestionChannelRepository()
const ingestionLogRepository = new IngestionLogRepository()

let activeConsumer: Awaited<ReturnType<typeof getConsumer>> | undefined

function sourceChannelForType(channelType: PollJobMessage['channelType']): string {
  if (channelType === 'EMAIL') return EMAIL_SOURCE_CHANNEL
  if (channelType === 'WHATSAPP') return 'WHATSAPP_INGESTION'
  return 'FTP_INGESTION'
}

function sourceTypeForChannelType(channelType: PollJobMessage['channelType']): PipelineSource {
  switch (channelType) {
    case 'FTP':
    case 'SFTP':
    case 'S3':
    case 'MINIO':
    case 'GCP':
    case 'AZURE':
      return 'ftp'
    case 'WHATSAPP':
      return 'whatsapp'
    case 'EMAIL':
      return 'email'
    default:
      return 'ftp'
  }
}

function buildLandingPath(
  orgId: string,
  file: FileDescriptor,
  sourceChannel: string,
): string {
  const date = new Date().toISOString().split('T')[0]
  const channel = sourceChannel.toLowerCase().replace('_ingestion', '')
  return `${orgId}/${file.insuranceCompanyCode}/${date}/${channel}/${file.claimFolder}/${file.fileName}`
}

async function createIngestionLog(
  job: PollJobMessage,
  file: FileDescriptor,
  landingPath: string,
  status: 'SUCCESS' | 'FAILED',
  errorMessage?: string,
): Promise<void> {
  await ingestionLogRepository.createLog({
    org_id: job.orgId,
    insurance_company_code: file.insuranceCompanyCode,
    channel_type: job.channelType,
    source_path: file.filePath,
    landing_path: landingPath,
    file_name: file.fileName,
    file_size_bytes: file.fileSizeBytes,
    status,
    error_message: errorMessage,
    ingested_at: new Date(),
  })
}

async function handlePollJob(job: PollJobMessage): Promise<void> {
  const plainVaultToken = decryptText(job.vaultToken)

  const secrets = await vaultClient.listSecretsForService(job.kmsServiceId, plainVaultToken)

  // EMAIL diverges from FTP/WHATSAPP at secret selection: email secrets are stored under keyName
  // `imap:<email>` with value { email, password, imap_host, imap_port } and carry NO `provider`
  // field, so they are selected by value.email match rather than the provider-based finder below.
  if (job.channelType === 'EMAIL') {
    await handleEmailJob(job, secrets)
    return
  }

  const credSecret = secrets.find(
    (s) =>
      typeof s.value === 'object' &&
      s.value !== null &&
      'provider' in s.value &&
      (s.value as Record<string, unknown>).provider === job.channelType &&
      (job.channelType === 'MINIO' || s.keyName === job.credId)
  )
  if (!credSecret) {
    console.error(
      job.channelType === 'MINIO'
        ? `[poll-worker] No MINIO credential found for orgId ${job.orgId}`
        : `[poll-worker] No exact credential "${job.credId}" found for orgId ${job.orgId}`,
    )
    return
  }

  const insuranceCompanyCode = job.insuranceCompanyCode
  if (!insuranceCompanyCode) {
    console.error(
      `[poll-worker] ${job.channelType} job for orgId ${job.orgId} is missing insuranceCompanyCode; cannot build landing path.`,
    )
    return
  }

  if (job.channelType !== 'MINIO' && typeof job.sourcePrefix !== 'string') {
    console.error(
      `[poll-worker] ${job.channelType} job for orgId ${job.orgId} is missing sourcePrefix; refusing to scan with ambiguous tenant scope.`,
    )
    return
  }

  const sourceCredentials: Record<string, unknown> = {
    ...(credSecret.value as Record<string, unknown>),
    insuranceCompanyCode,
    ...(job.channelType === 'MINIO' ? {} : { source_prefix: job.sourcePrefix }),
  }

  console.log('sourceCredentials line 128 pool.ts>>>>>>>>>>>>>>>>>>', sourceCredentials)
  const sourceChannel = sourceChannelForType(job.channelType)

  const files = await listNewFiles({
    orgId: job.orgId,
    sourceCredentials,
    fileName: '',
    mimeType: '',
    fileSizeBytes: 0,
    sourceChannel,
  })

  if (files.length === 0) {
    const sourcePrefix =
      typeof sourceCredentials.source_prefix === 'string'
        ? sourceCredentials.source_prefix
        : ''
    console.error(
      `[poll-worker] Source scan returned no matching files for orgId ${job.orgId}, ` +
        `provider ${job.channelType}, source_prefix "${sourcePrefix}". ` +
        'Verify the FTP path, permissions, and that the directory contains files.',
    )
    return
  }

  console.log(`[poll-worker] ${files.length} files found for orgId ${job.orgId}`)

  const transferFile = async (file: FileDescriptor): Promise<string> => {
    const stream = await readFromSource({
      orgId: job.orgId,
      sourceCredentials,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      sourceChannel,
      filePath: file.filePath,
    })

    const result = await writeToLanding(stream, {
      orgId: job.orgId,
      insuranceCompanyCode: file.insuranceCompanyCode,
      contextFolder: file.claimFolder,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      sourceChannel,
    })
    return result.objectKey
  }

  const redis = getRedisClient()
  const sourceType: PipelineSource = sourceTypeForChannelType(job.channelType)

  const limit = pLimit(config.pollConcurrency)
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        // Redis dedup for FTP and WHATSAPP.
        const dedupKey = buildDedupKey(
          sourceType,
          job.orgId,
          insuranceCompanyCode,
          file.filePath
        )

        // Step 1: try to claim this file
        const claimed = await redis.set(dedupKey, 'processing', 'EX', config.dedupTtlSec, 'NX')
        if (claimed === null) {
          console.log(`[poll-worker] Skipping already processed: ${file.fileName}`)
          return
        }

        const expectedLandingPath = buildLandingPath(job.orgId, file, sourceChannel)
        let landingPath: string
        try {
          landingPath = await transferFile(file)
        } catch (err) {
          // Step 3: release lock on failure so next cycle can retry
          const error = err instanceof Error ? err : new Error(String(err))
          await Promise.all([
            redis.del(dedupKey),
            createIngestionLog(job, file, expectedLandingPath, 'FAILED', error.message),
          ])
          console.error(`[poll-worker] ❌ Failed ${file.fileName} for orgId ${job.orgId}:`, error)
          return
        }

        // Step 2: mark as processed with long TTL
        await Promise.all([
          redis.set(dedupKey, 'processed', 'EX', config.dedupTtlSec),
          createIngestionLog(job, file, landingPath, 'SUCCESS'),
        ])
        console.log(`[poll-worker] ✅ ${file.fileName} uploaded for orgId ${job.orgId}`)
      })
    )
  )
}

/**
 * EMAIL pipeline. No Redis dedup here — the email reader (Part 1) already deduplicates attachments
 * within a UID via SHA-256, and cross-poll dedup is handled by the `last_processed_uid` watermark.
 * Email content was already downloaded into descriptor.emailMeta.bufferedContent during listNewFiles,
 * so we stream from memory and never call readFromSource/readFile for email.
 */
async function handleEmailJob(job: PollJobMessage, secrets: VaultSecretListItem[]): Promise<void> {
  const email = job.emailAddress
  if (!email) {
    console.error(`[poll-worker] EMAIL job for orgId ${job.orgId} is missing emailAddress; cannot resolve credentials.`)
    return
  }

  const insuranceCompanyCode = job.insuranceCompanyCode
  if (!insuranceCompanyCode) {
    console.error(
      `[poll-worker] EMAIL job for orgId ${job.orgId} is missing insuranceCompanyCode; cannot resolve channel row.`,
    )
    return
  }

  const picked = secrets.find(
    (s) =>
      typeof s.value === 'object' &&
      s.value !== null &&
      !Array.isArray(s.value) &&
      (s.value as Record<string, unknown>).email === email
  )
  if (!picked) {
    console.error(`[poll-worker] No IMAP credential (value.email=${email}) found in KMS for orgId ${job.orgId}`)
    return
  }

  // Fresh cursor from DB — never trust a stale value from the job message, since multiple poll
  // cycles for the same source could be in flight.
  const row = await ingestionChannelRepository.findByOrgIdInsurerAndChannel(
    job.orgId,
    insuranceCompanyCode,
    'EMAIL',
  )
  if (!row) {
    console.error(
      `[poll-worker] Email channel ${email} not found in Ingestion_Channel_Master; skipping.`,
    )
    return
  }

  const sourceCredentials: Record<string, unknown> = {
    ...(picked.value as Record<string, unknown>),
    provider: 'EMAIL',
    insuranceCompanyCode,
    lastProcessedUid: row.last_processed_uid ?? 0,
    lastUidValidity: row.imap_uidvalidity,
    region: row.region ?? 'eu-central-1',
  }

  console.log('sourceCredentials line 282 pool.ts>>>>>>>>>>>>>>>>>>', sourceCredentials)

  const descriptors = await listNewFiles({
    orgId: job.orgId,
    sourceCredentials,
    fileName: '',
    mimeType: '',
    fileSizeBytes: 0,
    sourceChannel: EMAIL_SOURCE_CHANNEL,
  })

  if (descriptors.length === 0) {
    // Do NOT advance the cursor: the reader only surfaces matched UIDs, so with no matches we have
    // no higher watermark to record.
    console.log(`[poll-worker] No new claim emails for ${email} (orgId ${job.orgId})`)
    return
  }

  console.log(`[poll-worker] ${descriptors.length} email descriptor(s) for ${email} (orgId ${job.orgId})`)

  const limit = pLimit(config.pollConcurrency)
  await Promise.all(
    descriptors.map((descriptor) =>
      limit(async () => {
        const expectedLandingPath = buildLandingPath(
          job.orgId,
          descriptor,
          EMAIL_SOURCE_CHANNEL,
        )
        const buf = descriptor.emailMeta?.bufferedContent
        if (!buf) {
          const error = new Error(
            `Descriptor ${descriptor.fileName} for ${email} has no buffered content.`,
          )
          await createIngestionLog(
            job,
            descriptor,
            expectedLandingPath,
            'FAILED',
            error.message,
          )
          console.error(`[poll-worker] Descriptor ${descriptor.fileName} for ${email} has no buffered content; skipping.`)
          return
        }

        let landingPath: string
        try {
          const result = await writeToLanding(Readable.from(buf), {
            orgId: job.orgId,
            insuranceCompanyCode: descriptor.insuranceCompanyCode,
            contextFolder: descriptor.claimFolder,
            fileName: descriptor.fileName,
            mimeType: descriptor.mimeType,
            fileSizeBytes: descriptor.fileSizeBytes,
            sourceChannel: EMAIL_SOURCE_CHANNEL,
          })
          landingPath = result.objectKey
        } catch (err) {
          // Per-descriptor isolation so one bad attachment does not block the rest of the batch.
          const error = err instanceof Error ? err : new Error(String(err))
          await createIngestionLog(
            job,
            descriptor,
            expectedLandingPath,
            'FAILED',
            error.message,
          )
          console.error(`[poll-worker] ❌ Failed ${descriptor.fileName} for ${email} (orgId ${job.orgId}):`, error)
          return
        }

        await createIngestionLog(job, descriptor, landingPath, 'SUCCESS')
        console.log(`[poll-worker] ✅ ${descriptor.fileName} uploaded for ${email} (orgId ${job.orgId})`)
      })
    )
  )

  // Cursor advance — matches ingestion.service.ts semantics: the original sets `maxSeenUid` per UID
  // as it scans and advances `last_processed_uid` in its `finally` regardless of upload success
  // ("advance on scan, not on full success"). We mirror that by advancing to the highest UID present
  // in this batch after attempting all writes. (Part 1's reader only returns matched UIDs, so the best
  // available high-water mark is max(emailMeta.imapUid) across the returned descriptors.)
  const maxUid = descriptors.reduce((acc, d) => Math.max(acc, d.emailMeta?.imapUid ?? 0), 0)
  const observedUidValidity =
    descriptors.find((d) => d.emailMeta?.uidValidity != null)?.emailMeta?.uidValidity ?? null

  // Persist the UIDVALIDITY generation alongside the cursor. When UIDVALIDITY changed (mailbox reset),
  // the reader resynced from 0, so maxUid may be LOWER than the stored cursor — we must adopt it as the
  // new generation's watermark, otherwise the same batch reprocesses every cycle. When UIDVALIDITY is
  // unchanged, advance the cursor only forward (standard high-water-mark semantics).
  const updates: { last_processed_uid?: number; imap_uidvalidity?: string } = {}
  const uidValidityChanged =
    observedUidValidity !== null && observedUidValidity !== row.imap_uidvalidity
  if (uidValidityChanged) {
    updates.imap_uidvalidity = observedUidValidity
    if (maxUid > 0) updates.last_processed_uid = maxUid
  } else {
    if (maxUid > (row.last_processed_uid ?? 0)) updates.last_processed_uid = maxUid
    if (observedUidValidity !== null && row.imap_uidvalidity === null) {
      updates.imap_uidvalidity = observedUidValidity
    }
  }

  if (Object.keys(updates).length > 0) {
    await ingestionChannelRepository.updateEmailCursor(job.orgId, insuranceCompanyCode, updates)
    console.log(
      `[poll-worker] Persisted cursor for ${email}: ${JSON.stringify(updates)}`,
    )
  }
}

export async function startWorkerPool(): Promise<void> {
  const consumer = await getConsumer(WORKER_GROUP_ID)
  activeConsumer = consumer

  await consumer.subscribe({ topic: config.pollJobsTopic, fromBeginning: false })

  const messageLimit = pLimit(config.pollConcurrency)

  void consumer
    .run({
      eachMessage: async ({ message }) => {
        await messageLimit(async () => {
          try {
            const job: PollJobMessage = JSON.parse(message.value!.toString())
            await handlePollJob(job)
          } catch (err) {
            console.error('[poll-worker] Failed to process message:', err)
          }
        })
      },
    })
    .catch((err) => {
      console.error('[poll-worker] Consumer run failed:', err)
    })
}

export async function stopWorkerPool(): Promise<void> {
  if (!activeConsumer) {
    return
  }
  await activeConsumer.stop()
  await activeConsumer.disconnect()
  activeConsumer = undefined
}
