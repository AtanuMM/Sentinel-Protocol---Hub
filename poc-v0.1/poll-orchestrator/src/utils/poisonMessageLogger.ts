import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

const POISON_LOG_PATH = path.resolve(process.cwd(), 'logs', 'poison-messages.log')

export interface PoisonMessageLogEntry {
  kind: 'validation' | 'processing' | 'parse'
  topic: string
  partition: number
  offset: string
  key: string | null
  timestamp: string
  rawValue: string
  reasons?: string[]
  parsedPayload?: unknown
  error?: string
  stack?: string
}

export async function logPoisonMessage(entry: PoisonMessageLogEntry): Promise<void> {
  try {
    const line = `${JSON.stringify({ loggedAt: new Date().toISOString(), ...entry })}\n`
    await mkdir(path.dirname(POISON_LOG_PATH), { recursive: true })
    await appendFile(POISON_LOG_PATH, line, 'utf8')
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.warn(`[poll-worker] Failed to write poison message log: ${error}`)
    console.warn('[poll-worker] Poison message details:', JSON.stringify(entry))
  }
}
