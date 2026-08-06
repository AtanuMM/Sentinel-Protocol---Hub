import type { StorageWriterConfig } from '../types'

const REDACTED = '***REDACTED***'

/** Safe copy of StorageWriterConfig for logs — never includes secret keys. */
export function redactStorageConfig(config: StorageWriterConfig): Record<string, unknown> {
  const rest = { ...config } as Record<string, unknown>
  if ('accessKeyId' in rest) rest.accessKeyId = REDACTED
  if ('secretAccessKey' in rest) rest.secretAccessKey = REDACTED
  if ('accessKey' in rest) rest.accessKey = REDACTED
  if ('secretKey' in rest) rest.secretKey = REDACTED
  return rest
}
