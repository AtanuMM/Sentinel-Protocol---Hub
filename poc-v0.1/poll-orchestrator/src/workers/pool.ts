import { listNewFiles, readFromSource, writeToLanding } from '@sentinel/storage-core'
import pLimit from 'p-limit'
import { config } from '../config'
import { getConsumer, type PollJobMessage } from '../kafka'
import { decryptText } from '../utils/crypto'
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

  const limit = pLimit(config.pollConcurrency)
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
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

          console.log(`[poll-worker] ✅ ${file.fileName} uploaded for orgId ${job.orgId}`)
        } catch (err) {
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
