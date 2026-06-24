export type PipelineSource = "ftp" | "email";

export const buildDedupKey = (
  source: PipelineSource,
  orgId: string,
  bucket: string,
  filename: string,
  etag: string,
): string => `file:dedup:${source}:${orgId}:${bucket}:${filename}:${etag}`;
