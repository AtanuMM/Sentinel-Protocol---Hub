import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { Readable } from 'stream'
import type { S3WriterConfig, TransferResult, WriteInput, WriterDriver } from '../../types'

function requireConfigField(
  value: string | undefined,
  name: string,
): string {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) {
    throw new Error(`${name} env var is not set; cannot write to Sentinel S3 landing bucket.`)
  }
  return v
}

function resolveS3Client(storageConfig: S3WriterConfig): S3Client {
  const region = requireConfigField(storageConfig.region, 'AWS_REGION')
  const endpoint = storageConfig.endpoint?.trim()

  return new S3Client({
    region,
    credentials: {
      accessKeyId: requireConfigField(storageConfig.accessKeyId, 'AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireConfigField(storageConfig.secretAccessKey, 'AWS_SECRET_ACCESS_KEY'),
    },
    ...(endpoint ? { endpoint } : {}),
  })
}

export const s3WriterDriver: WriterDriver = {
  async write(
    stream: Readable,
    input: WriteInput,
    objectKey: string,
    storageConfig: S3WriterConfig,
  ): Promise<TransferResult> {
    const bucket = requireConfigField(storageConfig.bucket, 'AWS_BUCKET')

    if (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes < 0) {
      throw new Error('fileSizeBytes must be a non-negative finite number for S3 streaming upload.')
    }

    const client = resolveS3Client(storageConfig)

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: objectKey,
        Body: stream,
        ContentType: input.mimeType,
        ...(input.objectMetadata ? { Metadata: input.objectMetadata } : {}),
      },
    })

    await upload.done()

    return {
      objectKey,
      bucketName: bucket,
      storageProvider: storageConfig.provider,
      fileSizeBytes: input.fileSizeBytes,
    }
  },
}
