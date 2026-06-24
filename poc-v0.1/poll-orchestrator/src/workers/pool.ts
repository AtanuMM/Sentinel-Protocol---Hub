import { listNewFiles, readFromSource, writeToLanding } from '@sentinel/storage-core'
import type { FileDescriptor } from '@sentinel/storage-core'
import pLimit from 'p-limit'
import { Readable } from 'stream'
import { config } from '../config'
import { getConsumer, type PollJobMessage } from '../kafka'
import { EmailSource } from '../models/email-source.model'
import { getRedisClient } from '../redis'
import { decryptText } from '../utils/crypto'
import { buildDedupKey, type PipelineSource } from '../utils/dedupKey'
import { vaultClient, type VaultSecretListItem } from '../utils/vault-client'

const WORKER_GROUP_ID = 'poll-orchestrator-workers'
const EMAIL_SOURCE_CHANNEL = 'EMAIL_INGESTION'

let activeConsumer: Awaited<ReturnType<typeof getConsumer>> | undefined

function sourceChannelForType(channelType: PollJobMessage['channelType']): string {
  if (channelType === 'FTP') {
    return 'FTP_INGESTION'
  }
  if (channelType === 'EMAIL') {
    return EMAIL_SOURCE_CHANNEL
  }
  return 'WHATSAPP_INGESTION'
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
    (s) => typeof s.value === 'object' && s.value !== null && 'provider' in s.value
  )
  if (!credSecret) {
    console.error(`[poll-worker] No provider credential found for orgId ${job.orgId}`)
    return
  }

  const sourceCredentials = credSecret.value as Record<string, unknown>
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
    console.log(`[poll-worker] No new files for orgId ${job.orgId}`)
    return
  }

  console.log(`[poll-worker] ${files.length} files found for orgId ${job.orgId}`)

  const transferFile = async (file: FileDescriptor): Promise<void> => {
    const stream = await readFromSource({
      orgId: job.orgId,
      sourceCredentials,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      sourceChannel,
      filePath: file.filePath,
    })

    await writeToLanding(stream, {
      orgId: job.orgId,
      zoneId: file.zoneId,
      contextFolder: file.claimFolder,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      sourceChannel,
    })
  }

  const redis = getRedisClient()
  const sourceType: PipelineSource = job.channelType === 'FTP' ? 'ftp' : 'whatsapp'

  const limit = pLimit(config.pollConcurrency)
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        // Redis dedup for FTP and WHATSAPP.
        const dedupKey = buildDedupKey(
          sourceType,
          job.orgId,
          file.filePath.split('/')[1] ?? '',
          file.filePath
        )

        // Step 1: try to claim this file
        const claimed = await redis.set(dedupKey, 'processing', 'EX', config.dedupTtlSec, 'NX')
        if (claimed === null) {
          console.log(`[poll-worker] Skipping already processed: ${file.fileName}`)
          return
        }

        try {
          await transferFile(file)
          // Step 2: mark as processed with long TTL
          await redis.set(dedupKey, 'processed', 'EX', config.dedupTtlSec)
          console.log(`[poll-worker] ✅ ${file.fileName} uploaded for orgId ${job.orgId}`)
        } catch (err) {
          // Step 3: release lock on failure so next cycle can retry
          await redis.del(dedupKey)
          console.error(`[poll-worker] ❌ Failed ${file.fileName} for orgId ${job.orgId}:`, err)
        }
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
  const row = await EmailSource.findByPk(email)
  if (!row) {
    console.error(`[poll-worker] Email source ${email} not found in Email_Source_Master; skipping.`)
    return
  }

  const sourceCredentials: Record<string, unknown> = {
    ...(picked.value as Record<string, unknown>),
    provider: 'EMAIL',
    lastProcessedUid: row.last_processed_uid,
    zoneId: row.zone_id,
  }

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
        const buf = descriptor.emailMeta?.bufferedContent
        if (!buf) {
          console.error(`[poll-worker] Descriptor ${descriptor.fileName} for ${email} has no buffered content; skipping.`)
          return
        }
        try {
          await writeToLanding(Readable.from(buf), {
            orgId: job.orgId,
            zoneId: descriptor.zoneId,
            contextFolder: descriptor.claimFolder,
            fileName: descriptor.fileName,
            mimeType: descriptor.mimeType,
            fileSizeBytes: descriptor.fileSizeBytes,
            sourceChannel: EMAIL_SOURCE_CHANNEL,
          })
          console.log(`[poll-worker] ✅ ${descriptor.fileName} uploaded for ${email} (orgId ${job.orgId})`)
        } catch (err) {
          // Per-descriptor isolation so one bad attachment does not block the rest of the batch.
          console.error(`[poll-worker] ❌ Failed ${descriptor.fileName} for ${email} (orgId ${job.orgId}):`, err)
        }
      })
    )
  )

  // Cursor advance — matches ingestion.service.ts semantics: the original sets `maxSeenUid` per UID
  // as it scans and advances `last_processed_uid` in its `finally` regardless of upload success
  // ("advance on scan, not on full success"). We mirror that by advancing to the highest UID present
  // in this batch after attempting all writes. (Part 1's reader only returns matched UIDs, so the best
  // available high-water mark is max(emailMeta.imapUid) across the returned descriptors.)
  const maxUid = descriptors.reduce((acc, d) => Math.max(acc, d.emailMeta?.imapUid ?? 0), 0)
  if (maxUid > row.last_processed_uid) {
    await EmailSource.update({ last_processed_uid: maxUid }, { where: { email_address: email } })
    console.log(`[poll-worker] Advanced last_processed_uid to ${maxUid} for ${email}`)
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
