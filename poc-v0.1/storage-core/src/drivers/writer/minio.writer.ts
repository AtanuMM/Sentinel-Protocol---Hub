import * as Minio from 'minio'
import type { Readable } from 'stream'
import type { MinioWriterConfig, TransferResult, WriteInput, WriterDriver } from '../../types'

function requireConfigField(
  value: string | undefined,
  name: string,
): string {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) {
    throw new Error(`${name} env var is not set; cannot write to Sentinel MinIO landing bucket.`)
  }
  return v
}

function parseMinioEndpoint(endpoint: string): { endPoint: string; port: number; useSSL: boolean } {
  const trimmed = endpoint.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed)
    const useSSL = url.protocol === 'https:'
    const port = url.port ? parseInt(url.port, 10) : useSSL ? 443 : 80
    return { endPoint: url.hostname, port, useSSL }
  }
  const idx = trimmed.lastIndexOf(':')
  if (idx > 0) {
    const host = trimmed.slice(0, idx)
    const port = parseInt(trimmed.slice(idx + 1), 10)
    if (host && !Number.isNaN(port)) {
      return { endPoint: host, port, useSSL: port === 443 }
    }
  }
  return { endPoint: trimmed, port: 80, useSSL: false }
}

function resolveLandingMinioClientOptions(
  storageConfig: MinioWriterConfig,
): { endPoint: string; port: number; useSSL: boolean } {
  const raw = requireConfigField(storageConfig.endpoint, 'MINIO_ENDPOINT')
  if (/^https?:\/\//i.test(raw)) {
    return parseMinioEndpoint(raw)
  }
  const port = storageConfig.port ?? 9000
  const useSSL = storageConfig.useSSL ?? false
  return { endPoint: raw, port, useSSL }
}

export const minioWriterDriver: WriterDriver = {
  async write(
    stream: Readable,
    input: WriteInput,
    objectKey: string,
    storageConfig: MinioWriterConfig,
  ): Promise<TransferResult> {
    const accessKey = requireConfigField(storageConfig.accessKey, 'MINIO_ACCESS_KEY')
    const secretKey = requireConfigField(storageConfig.secretKey, 'MINIO_SECRET_KEY')
    const bucket = requireConfigField(storageConfig.bucket, 'MINIO_BUCKET')

    if (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes < 0) {
      throw new Error('fileSizeBytes must be a non-negative finite number for MinIO streaming upload.')
    }

    const { endPoint, port, useSSL } = resolveLandingMinioClientOptions(storageConfig)
    const client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    })

    const metaData: Record<string, string> = {
      'Content-Type': input.mimeType,
      ...(input.objectMetadata ?? {}),
    }

    await client.putObject(bucket, objectKey, stream, input.fileSizeBytes, metaData)

    return {
      objectKey,
      bucketName: bucket,
      storageProvider: storageConfig.provider,
      fileSizeBytes: input.fileSizeBytes,
    }
  },
}
