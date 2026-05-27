import * as Minio from 'minio'
import type { Readable } from 'stream'
import type { BucketItem } from 'minio'
import type { FileDescriptor, ReaderDriver } from '../../types'

function requireString(c: Record<string, any>, key: string, ctx: string): string {
  const v = c[key]
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`MinIO reader sourceCredentials.${key} is missing or empty (${ctx}).`)
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

function fileDescriptorFromObjectKey(
  key: string,
  orgId: string,
  size: number,
): FileDescriptor | null {
  const parts = key.split('/').filter(Boolean)
  if (parts.length < 6 || parts[0] !== 'Health_Claims') return null
  const zoneId = parts[1]
  const claimFolder = parts[4]
  const fileName = parts[parts.length - 1]
  if (!zoneId || !claimFolder || !fileName) return null
  const lower = fileName.toLowerCase()
  const mimeType = lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
  return { orgId, zoneId, claimFolder, fileName, filePath: key, fileSizeBytes: size, mimeType }
}

function listObjectsRecursive(client: Minio.Client, bucket: string, prefix: string): Promise<BucketItem[]> {
  return new Promise((resolve, reject) => {
    const items: BucketItem[] = []
    const stream = client.listObjects(bucket, prefix, true)
    stream.on('data', (obj: BucketItem) => {
      items.push(obj)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve(items))
  })
}

export const minioReaderDriver: ReaderDriver = {
  async listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]> {
    const endpoint = requireString(credentials, 'endpoint', `orgId ${orgId}`)
    const accessKey = requireString(credentials, 'access_key', `orgId ${orgId}`)
    const secretKey = requireString(credentials, 'secret_key', `orgId ${orgId}`)
    const bucket = requireString(credentials, 'bucket', `orgId ${orgId}`)

    const { endPoint, port, useSSL } = parseMinioEndpoint(endpoint)
    const client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    })

    const objects = await listObjectsRecursive(client, bucket, 'Health_Claims/')
    const out: FileDescriptor[] = []
    for (const obj of objects) {
      if (!obj.name || obj.name.endsWith('/')) continue
      const size = typeof obj.size === 'number' ? obj.size : 0
      const fd = fileDescriptorFromObjectKey(obj.name, orgId, size)
      if (fd) out.push(fd)
    }
    return out
  },

  async readFile(credentials: Record<string, any>, filePath: string): Promise<Readable> {
    const endpoint = requireString(credentials, 'endpoint', 'readFile')
    const accessKey = requireString(credentials, 'access_key', 'readFile')
    const secretKey = requireString(credentials, 'secret_key', 'readFile')
    const bucket = requireString(credentials, 'bucket', 'readFile')

    const { endPoint, port, useSSL } = parseMinioEndpoint(endpoint)
    const client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    })

    return await client.getObject(bucket, filePath)
  },
}
