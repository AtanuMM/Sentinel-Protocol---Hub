import { randomUUID } from 'crypto'
import type { Readable } from 'stream'
import { publishEvent } from './kafka-client'
import type { KafkaEventPayload, StorageWriterConfig, TransferResult, WriteInput } from './types'
import { azureWriterDriver } from './drivers/writer/azure.writer'
import { gcpWriterDriver } from './drivers/writer/gcp.writer'
import { minioWriterDriver } from './drivers/writer/minio.writer'
import { s3WriterDriver } from './drivers/writer/s3.writer'
import { redactStorageConfig } from './utils/redactStorageConfig'

function buildObjectKey(input: WriteInput): string {
  const date = new Date().toISOString().split('T')[0]
  const channel = input.sourceChannel.toLowerCase().replace('_ingestion', '')
  return `${input.orgId}/${input.insuranceCompanyCode}/${date}/${channel}/${input.contextFolder}/${input.fileName}`
}

function buildKafkaPayload(input: WriteInput, result: TransferResult): KafkaEventPayload {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    orgId: input.orgId,
    insuranceCompanyCode: input.insuranceCompanyCode,
    sourceChannel: input.sourceChannel,
    payload: {
      fileName: input.fileName,
      storageProvider: result.storageProvider,
      bucketName: result.bucketName,
      objectKey: result.objectKey,
      fileSizeBytes: result.fileSizeBytes,
      mimeType: input.mimeType,
    },
  }
}

export async function writeToLanding(
  stream: Readable,
  input: WriteInput,
  storageConfig: StorageWriterConfig,
): Promise<TransferResult> {
  const objectKey = buildObjectKey(input)
  console.log('[storage-core] writeToLanding payload:', {
    input,
    storageConfig: redactStorageConfig(storageConfig),
    objectKey,
  })
  let result: TransferResult
  switch (storageConfig.provider) {
    case 'MINIO':
      result = await minioWriterDriver.write(stream, input, objectKey, storageConfig)
      break
    case 'S3':
      result = await s3WriterDriver.write(stream, input, objectKey, storageConfig)
      break
    case 'GCP':
      result = await gcpWriterDriver.write(stream, input, objectKey, storageConfig)
      break
    case 'AZURE':
      result = await azureWriterDriver.write(stream, input, objectKey, storageConfig)
      break
    default: {
      const unknownProvider = (storageConfig as { provider?: string }).provider ?? 'unknown'
      throw new Error(
        `Unsupported storage writer provider "${unknownProvider}". Expected one of: MINIO, S3, GCP, AZURE`,
      )
    }
  }
  try {
    await publishEvent(buildKafkaPayload(input, result))
  } catch (err) {
    console.error('[storage-core] Kafka publish failed (file already uploaded):', err)
  }
  return result
}
