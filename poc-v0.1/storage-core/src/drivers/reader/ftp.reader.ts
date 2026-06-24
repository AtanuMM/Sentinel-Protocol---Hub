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

/** Path: /Health_Claims/{TPA}/{YYYY}/{MM_Month}/{CLM-...}/{filename} */
function fileDescriptorFromParts(
  parts: string[],
  orgId: string,
  filePath: string,
  fileSizeBytes: number,
): FileDescriptor | null {
  if (parts.length < 6) return null
  const zoneId = parts[1]
  const claimFolder = parts[4]
  const fileName = parts[parts.length - 1]
  if (!zoneId || !claimFolder || !fileName) return null
  const lower = fileName.toLowerCase()
  const mimeType = lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
  return { orgId, zoneId, claimFolder, fileName, filePath, fileSizeBytes, mimeType }
}

async function walkFtpTree(
  client: Client,
  dir: string,
  orgId: string,
  out: FileDescriptor[],
): Promise<void> {
  const list = await client.list(dir)
  for (const ent of list) {
    const name = ent.name
    if (name === '.' || name === '..') continue
    const fullPath = joinPosix(dir, name)
    if (ent.type === FileType.Directory) {
      await walkFtpTree(client, fullPath, orgId, out)
    } else if (ent.type === FileType.File) {
      const parts = fullPath.split('/').filter(Boolean)
      const fd = fileDescriptorFromParts(parts, orgId, fullPath.startsWith('/') ? fullPath : `/${fullPath}`, ent.size)
      if (fd) out.push(fd)
    }
  }
}

export const ftpReaderDriver: ReaderDriver = {
  async listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]> {
    const host = requireString(credentials, 'host', `orgId ${orgId}`)
    const user = requireString(credentials, 'user', `orgId ${orgId}`)
    const password = requireString(credentials, 'password', `orgId ${orgId}`)
    const port = typeof credentials.port === 'number' && Number.isFinite(credentials.port) ? credentials.port : 21

    let secure: boolean | 'implicit' = false
    if (credentials.secure === true || credentials.secure === 'true' || credentials.explicit_tls === true) {
      secure = true
    } else if (credentials.secure === 'implicit' || credentials.implicit_tls === true) {
      secure = 'implicit'
    }

    const client = new Client()
    const root = '/'
    const out: FileDescriptor[] = []
    try {
      await client.access({ host, port, user, password, secure })
      await walkFtpTree(client, root, orgId, out)
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
