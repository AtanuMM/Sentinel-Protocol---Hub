import { listNewFiles, readFromSource, writeToLanding } from '@sentinel/storage-core'
import type { FileDescriptor } from '@sentinel/storage-core'
import pLimit from 'p-limit'
import { config } from '../config'
import { getConsumer, type PollJobMessage } from '../kafka'
import { getRedisClient } from '../redis'
import { decryptText } from '../utils/crypto'
import { buildDedupKey, type PipelineSource } from '../utils/dedupKey'
import { vaultClient } from '../utils/vault-client'

const WORKER_GROUP_ID = 'poll-orchestrator-workers'

let activeConsumer: Awaited<ReturnType<typeof getConsumer>> | undefined

function sourceChannelForType(channelType: PollJobMessage['channelType']): string {
  if (channelType === 'FTP') {
    return 'FTP_INGESTION'
  }
  if (channelType === 'EMAIL') {
    return 'EMAIL_INGESTION'
  }
  return 'WHATSAPP_INGESTION'
}

async function handlePollJob(job: PollJobMessage): Promise<void> {
  const plainVaultToken = decryptText(job.vaultToken)

  const secrets = await vaultClient.listSecretsForService(job.kmsServiceId, plainVaultToken)

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
  const sourceType: PipelineSource =
    job.channelType === 'FTP' ? 'ftp' : job.channelType === 'EMAIL' ? 'email' : 'whatsapp'

  const limit = pLimit(config.pollConcurrency)
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        // EMAIL uses last_processed_uid watermark — no file-path dedup needed.
        if (job.channelType === 'EMAIL') {
          try {
            await transferFile(file)
            console.log(`[poll-worker] ✅ ${file.fileName} uploaded for orgId ${job.orgId}`)
          } catch (err) {
            console.error(`[poll-worker] ❌ Failed ${file.fileName} for orgId ${job.orgId}:`, err)
          }
          return
        }

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
