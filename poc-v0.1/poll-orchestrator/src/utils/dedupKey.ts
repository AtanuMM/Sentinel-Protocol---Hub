export type PipelineSource = 'ftp' | 'email' | 'whatsapp'

export function buildDedupKey(
  source: PipelineSource,
  orgId: string,
  bucket: string,
  filePath: string,
): string {
  return `file:dedup:${source}:${orgId}:${bucket}:${filePath}`
}
