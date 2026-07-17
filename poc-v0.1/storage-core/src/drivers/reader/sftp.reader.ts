import SftpClient from 'ssh2-sftp-client'
import { PassThrough } from 'stream'
import type { Readable } from 'stream'
import type { FileDescriptor, ReaderDriver } from '../../types'

function requireString(c: Record<string, any>, key: string, ctx: string): string {
  const v = c[key]
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`SFTP sourceCredentials.${key} is missing or empty (${ctx}).`)
  }
  return v
}

function joinPosix(dir: string, name: string): string {
  const d = dir.endsWith('/') ? dir.slice(0, -1) : dir
  return `${d}/${name}`
}

function requireInsuranceCompanyCode(c: Record<string, any>, ctx: string): string {
  const raw = c.insuranceCompanyCode ?? c.insurance_company_code
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`SFTP sourceCredentials.insuranceCompanyCode is missing or empty (${ctx}).`)
  }
  return raw.trim()
}

/** Path: /Health_Claims/{TPA}/{YYYY}/{MM_Month}/{CLM-...}/{filename} */
function fileDescriptorFromParts(
  parts: string[],
  orgId: string,
  insuranceCompanyCode: string,
  filePath: string,
  fileSizeBytes: number,
): FileDescriptor | null {
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
    filePath,
    fileSizeBytes,
    mimeType,
  }
}

async function walkSftpTree(
  client: SftpClient,
  dir: string,
  orgId: string,
  insuranceCompanyCode: string,
  out: FileDescriptor[],
): Promise<void> {
  try {
    const list = await client.list(dir)
    for (const ent of list) {
      const name = ent.name
      if (name === '.' || name === '..') continue
      const fullPath = joinPosix(dir, name)
      if (ent.type === 'd') {
        await walkSftpTree(client, fullPath, orgId, insuranceCompanyCode, out)
      } else if (ent.type === '-') {
        const parts = fullPath.split('/').filter(Boolean)
        // console.log('[sftp-reader] found file:', fullPath, 'parts:', fullPath.split('/').filter(Boolean))
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[sftp-reader] Skipping inaccessible directory ${dir}: ${msg}`)
    return
  }
}

export const sftpReaderDriver: ReaderDriver = {
  async listNewFiles(orgId: string, credentials: Record<string, any>): Promise<FileDescriptor[]> {
    const host = requireString(credentials, 'host', `orgId ${orgId}`)
    const user = requireString(credentials, 'user', `orgId ${orgId}`)
    const password = requireString(credentials, 'password', `orgId ${orgId}`)
    const insuranceCompanyCode = requireInsuranceCompanyCode(credentials, `orgId ${orgId}`)
    const port = typeof credentials.port === 'number' && Number.isFinite(credentials.port) ? credentials.port : 22

    const client = new SftpClient()
    const bucket = typeof credentials.bucket === 'string' ? credentials.bucket.trim().replace(/^\//, '') : ''
    const out: FileDescriptor[] = []
    try {
      console.log('[sftp-reader] connecting to:', host, port, 'bucket:', bucket)
      await client.connect({ host, port, username: user, password })
      const cwd = await client.cwd()
      const root = bucket ? `${cwd}/${bucket}` : cwd
      console.log('[sftp-reader] connected, cwd:', cwd, 'resolved root:', root)
      await walkSftpTree(client, root, orgId, insuranceCompanyCode, out)
      return out
    } finally {
      void client.end()
    }
  },

  async readFile(credentials: Record<string, any>, filePath: string): Promise<Readable> {
    const host = requireString(credentials, 'host', 'readFile')
    const user = requireString(credentials, 'user', 'readFile')
    const password = requireString(credentials, 'password', 'readFile')
    const port = typeof credentials.port === 'number' && Number.isFinite(credentials.port) ? credentials.port : 22

    const client = new SftpClient()
    await client.connect({ host, port, username: user, password })

    const stream = new PassThrough({ highWaterMark: 64 * 1024 })
    const readStream = client.createReadStream(filePath)

    readStream.pipe(stream)

    const disconnect = (): void => {
      void client.end()
    }

    readStream.on('end', disconnect)
    readStream.on('error', (err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err))
      stream.destroy(e)
      disconnect()
    })

    return stream
  },
}
