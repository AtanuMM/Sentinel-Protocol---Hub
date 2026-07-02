import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import type { Readable } from 'stream'
import type { FileDescriptor, ReaderDriver } from '../../types'

function requireString(c: Record<string, any>, key: string, ctx: string): string {
  const v = c[key]
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`S3 reader sourceCredentials.${key} is missing or empty (${ctx}).`)
  }
  return v
}

function requireInsuranceCompanyCode(c: Record<string, any>, ctx: string): string {
  const raw = c.insuranceCompanyCode ?? c.insurance_company_code
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`S3 reader sourceCredentials.insuranceCompanyCode is missing or empty (${ctx}).`)
  }
  return raw.trim()
}

function fileDescriptorFromObjectKey(
  key: string,
  orgId: string,
  insuranceCompanyCode: string,
  size: number,
): FileDescriptor | null {
  const parts = key.split('/').filter(Boolean)
  if (parts.length < 7) return null
  const claimFolder = parts[5]
  const fileName = parts[parts.length - 1]
  if (!claimFolder || !fileName) return null
  const lower = fileName.toLowerCase()
  const mimeType = lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
  return {
    orgId,
    insuranceCompanyCode,
    claimFolder,
    fileName,
    filePath: key,
    fileSizeBytes: size,
    mimeType,
  }
}

function createS3Client(credentials: Record<string, any>, ctx: string): S3Client {
  const accessKey = requireString(credentials, 'access_key', ctx)
  const secretKey = requireString(credentials, 'secret_key', ctx)
  const region = requireString(credentials, 'region', ctx)
  const endpoint = credentials.endpoint
  const endpointStr = typeof endpoint === 'string' ? endpoint.trim() : ''

  return new S3Client({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    ...(endpointStr ? { endpoint: endpointStr } : {}),
  })
}

async function listObjectsRecursive(
  client: S3Client,
  bucket: string,
): Promise<Array<{ Key: string; Size: number }>> {
  const items: Array<{ Key: string; Size: number }> = []
  let continuationToken: string | undefined

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of response.Contents ?? []) {
      if (obj.Key) {
        items.push({ Key: obj.Key, Size: typeof obj.Size === 'number' ? obj.Size : 0 })
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return items
}

export const s3ReaderDriver: ReaderDriver = {
  async listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]> {
    const bucket = requireString(credentials, 'bucket', `orgId ${orgId}`)
    const insuranceCompanyCode = requireInsuranceCompanyCode(credentials, `orgId ${orgId}`)
    const client = createS3Client(credentials, `orgId ${orgId}`)

    const objects = await listObjectsRecursive(client, bucket)
    const out: FileDescriptor[] = []
    for (const obj of objects) {
      if (obj.Key.endsWith('/')) continue
      const fd = fileDescriptorFromObjectKey(obj.Key, orgId, insuranceCompanyCode, obj.Size)
      if (fd) out.push(fd)
    }
    return out
  },

  async readFile(credentials: Record<string, any>, filePath: string): Promise<Readable> {
    const bucket = requireString(credentials, 'bucket', 'readFile')
    const client = createS3Client(credentials, 'readFile')

    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: filePath,
      }),
    )

    return response.Body as unknown as Readable
  },
}
