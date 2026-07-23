import { Client, FileType } from 'basic-ftp'
import { PassThrough } from 'stream'
import type { Readable } from 'stream'
import type { FileDescriptor, ReaderDriver } from '../../types'

function requireString(c: Record<string, any>, key: string, ctx: string): string {
  const v = c[key]
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`FTP sourceCredentials.${key} is missing or empty (${ctx}).`)
  }
  return v
}

function joinPosix(dir: string, name: string): string {
  const d = dir.endsWith('/') ? dir.slice(0, -1) : dir
  return `${d}/${name}`
}

function normalizeFtpPath(path: string): string {
  return path.trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

function requireInsuranceCompanyCode(c: Record<string, any>, ctx: string): string {
  const raw = c.insuranceCompanyCode ?? c.insurance_company_code
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`FTP sourceCredentials.insuranceCompanyCode is missing or empty (${ctx}).`)
  }
  return raw.trim()
}

function fileDescriptorFromParts(
  parts: string[],
  orgId: string,
  insuranceCompanyCode: string,
  filePath: string,
  fileSizeBytes: number,
): FileDescriptor | null {
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
    filePath,
    fileSizeBytes,
    mimeType,
  }
}

async function walkFtpTree(
  client: Client,
  dir: string,
  orgId: string,
  insuranceCompanyCode: string,
  sourcePrefix: string,
  out: FileDescriptor[],
): Promise<void> {
  const list = await client.list(dir)
  for (const ent of list) {
    const name = ent.name
    if (name === '.' || name === '..') continue
    const fullPath = joinPosix(dir, name)
    if (ent.type === FileType.Directory) {
      await walkFtpTree(client, fullPath, orgId, insuranceCompanyCode, sourcePrefix, out)
    } else if (ent.type === FileType.File) {
      const normalizedFullPath = normalizeFtpPath(fullPath)
      if (
        sourcePrefix &&
        normalizedFullPath !== sourcePrefix &&
        !normalizedFullPath.startsWith(`${sourcePrefix}/`)
      ) {
        continue
      }
      const relativePath = sourcePrefix
        ? normalizedFullPath.slice(sourcePrefix.length)
        : normalizedFullPath
      const parts = relativePath.split('/').filter(Boolean)
      const fd = fileDescriptorFromParts(
        parts,
        orgId,
        insuranceCompanyCode,
        fullPath.startsWith('/') ? fullPath : `/${fullPath}`,
        ent.size,
      )
      if (fd) out.push(fd)
    }
  }
}

export const ftpReaderDriver: ReaderDriver = {
  async listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]> {
    const host = requireString(credentials, 'host', `orgId ${orgId}`)
    const user = requireString(credentials, 'user', `orgId ${orgId}`)
    const password = requireString(credentials, 'password', `orgId ${orgId}`)
    const insuranceCompanyCode = requireInsuranceCompanyCode(credentials, `orgId ${orgId}`)
    const sourcePrefix =
      typeof credentials.source_prefix === 'string'
        ? normalizeFtpPath(credentials.source_prefix)
        : ''
    const port = typeof credentials.port === 'number' && Number.isFinite(credentials.port) ? credentials.port : 21

    let secure: boolean | 'implicit' = false
    if (credentials.secure === true || credentials.secure === 'true' || credentials.explicit_tls === true) {
      secure = true
    } else if (credentials.secure === 'implicit' || credentials.implicit_tls === true) {
      secure = 'implicit'
    }

    const client = new Client()
    const configuredRoot =
      typeof credentials.bucket === 'string' && credentials.bucket.trim() !== ''
        ? `/${normalizeFtpPath(credentials.bucket)}`
        : '/'
    const root = sourcePrefix ? `/${sourcePrefix}` : configuredRoot
    const out: FileDescriptor[] = []
    try {
      await client.access({ host, port, user, password, secure })
      await walkFtpTree(client, root, orgId, insuranceCompanyCode, sourcePrefix, out)
      return out
    } finally {
      void client.close()
    }
  },

  async readFile(credentials: Record<string, any>, filePath: string): Promise<Readable> {
    const host = requireString(credentials, 'host', 'readFile')
    const user = requireString(credentials, 'user', 'readFile')
    const password = requireString(credentials, 'password', 'readFile')
    const port = typeof credentials.port === 'number' && Number.isFinite(credentials.port) ? credentials.port : 21

    let secure: boolean | 'implicit' = false
    if (credentials.secure === true || credentials.secure === 'true' || credentials.explicit_tls === true) {
      secure = true
    } else if (credentials.secure === 'implicit' || credentials.implicit_tls === true) {
      secure = 'implicit'
    }

    const client = new Client()
    await client.access({ host, port, user, password, secure })

    const stream = new PassThrough({ highWaterMark: 64 * 1024 })

    void client
      .downloadTo(stream, filePath)
      .catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err))
        stream.destroy(e)
      })
      .finally(() => {
        void client.close()
      })

    return stream
  },
}
