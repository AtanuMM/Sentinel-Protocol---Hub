import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import type { Readable } from 'stream'
import type { FileDescriptor, ReaderDriver } from '../../types'

function requireString(c: Record<string, any>, key: string, ctx: string): string {
  const v = c[key]
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`Azure reader sourceCredentials.${key} is missing or empty (${ctx}).`)
  }
  return v
}

function requireInsuranceCompanyCode(c: Record<string, any>, ctx: string): string {
  const raw = c.insuranceCompanyCode ?? c.insurance_company_code
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `Azure reader sourceCredentials.insuranceCompanyCode is missing or empty (${ctx}).`,
    )
  }
  return raw.trim()
}

function fileDescriptorFromBlobName(
  blobName: string,
  sourcePrefix: string,
  orgId: string,
  insuranceCompanyCode: string,
  size: number,
): FileDescriptor | null {
  const relativePath = sourcePrefix ? blobName.slice(sourcePrefix.length) : blobName
  const parts = relativePath.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const claimFolder = parts[parts.length - 2]
  const fileName = parts[parts.length - 1]
  if (!claimFolder || !fileName) return null
  const lower = fileName.toLowerCase()
  const mimeType = lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
  return {
    orgId,
    insuranceCompanyCode,
    claimFolder,
    fileName,
    filePath: blobName,
    fileSizeBytes: size,
    mimeType,
  }
}

function createBlobServiceClient(credentials: Record<string, any>, ctx: string): BlobServiceClient {
  const accountName = requireString(credentials, 'account_name', ctx)
  const accountKey = requireString(credentials, 'account_key', ctx)
  const endpoint = credentials.endpoint
  const endpointStr =
    typeof endpoint === 'string' && endpoint.trim() !== ''
      ? endpoint.trim()
      : `https://${accountName}.blob.core.windows.net`

  const credential = new StorageSharedKeyCredential(accountName, accountKey)
  return new BlobServiceClient(endpointStr, credential)
}

async function listBlobsRecursive(
  containerClient: ContainerClient,
): Promise<Array<{ name: string; size: number }>> {
  const items: Array<{ name: string; size: number }> = []

  for await (const page of containerClient.listBlobsFlat().byPage()) {
    for (const blob of page.segment.blobItems) {
      if (blob.name) {
        items.push({
          name: blob.name,
          size: typeof blob.properties.contentLength === 'number' ? blob.properties.contentLength : 0,
        })
      }
    }
  }

  return items
}

export const azureReaderDriver: ReaderDriver = {
  async listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]> {
    const container = requireString(credentials, 'container', `orgId ${orgId}`)
    const insuranceCompanyCode = requireInsuranceCompanyCode(credentials, `orgId ${orgId}`)
    const sourcePrefix =
      typeof credentials.source_prefix === 'string' ? credentials.source_prefix : ''
    const blobServiceClient = createBlobServiceClient(credentials, `orgId ${orgId}`)
    const containerClient = blobServiceClient.getContainerClient(container)

    const blobs = await listBlobsRecursive(containerClient)
    const out: FileDescriptor[] = []
    for (const blob of blobs) {
      if (blob.name.endsWith('/')) continue
      if (sourcePrefix && !blob.name.startsWith(sourcePrefix)) continue
      const fd = fileDescriptorFromBlobName(
        blob.name,
        sourcePrefix,
        orgId,
        insuranceCompanyCode,
        blob.size,
      )
      if (fd) out.push(fd)
    }
    return out
  },

  async readFile(credentials: Record<string, any>, filePath: string): Promise<Readable> {
    const container = requireString(credentials, 'container', 'readFile')
    const blobServiceClient = createBlobServiceClient(credentials, 'readFile')
    const containerClient = blobServiceClient.getContainerClient(container)
    const blobClient = containerClient.getBlobClient(filePath)

    const response = await blobClient.download()
    if (!response.readableStreamBody) {
      throw new Error(`Azure blob "${filePath}" returned no readable stream body.`)
    }

    return response.readableStreamBody as unknown as Readable
  },
}
