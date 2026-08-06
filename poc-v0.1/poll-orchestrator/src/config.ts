import 'dotenv/config'
import type { StorageWriterConfig } from '@sentinel/storage-core'

function requireLandingEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    throw new Error(`${name} env var is not set; cannot write to Sentinel landing bucket.`)
  }
  return v
}

/** Resolve landing-bucket writer config from this service's .env for storage-core writeToLanding(). */
export function buildStorageWriterConfig(): StorageWriterConfig {
  const provider = process.env.STORAGE_PROVIDER?.trim().toUpperCase()
  if (!provider) {
    throw new Error(
      'STORAGE_PROVIDER env var is not set. Expected one of: MINIO, S3, GCP, AZURE',
    )
  }
  switch (provider) {
    case 'S3':
      return {
        provider: 'S3',
        region: requireLandingEnv('AWS_REGION'),
        endpoint: process.env.AWS_ENDPOINT?.trim() || undefined,
        accessKeyId: requireLandingEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: requireLandingEnv('AWS_SECRET_ACCESS_KEY'),
        bucket: requireLandingEnv('AWS_BUCKET'),
      }
    case 'MINIO': {
      const portRaw = process.env.MINIO_PORT?.trim()
      return {
        provider: 'MINIO',
        endpoint: requireLandingEnv('MINIO_ENDPOINT'),
        port: portRaw ? parseInt(portRaw, 10) : undefined,
        useSSL: process.env.MINIO_USE_SSL?.trim().toLowerCase() === 'true',
        accessKey: requireLandingEnv('MINIO_ACCESS_KEY'),
        secretKey: requireLandingEnv('MINIO_SECRET_KEY'),
        bucket: requireLandingEnv('MINIO_BUCKET'),
      }
    }
    case 'GCP':
      return { provider: 'GCP' }
    case 'AZURE':
      return { provider: 'AZURE' }
    default:
      throw new Error(
        `Unsupported STORAGE_PROVIDER "${provider}". Expected one of: MINIO, S3, GCP, AZURE`,
      )
  }
}

export const config = {
  dbUrl: process.env.DB_URL ?? '',
  kafkaBroker: process.env.KAFKA_BROKER ?? 'localhost:9092',
  pollJobsTopic: process.env.POLL_JOBS_TOPIC ?? 'poll-jobs',
  kmsBaseUrl: (process.env.KMS_BASE_URL ?? 'http://localhost:8000').trim(),
  vaultUrl: process.env.VAULT_URL ?? 'http://localhost:8000/api/v1',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '300000', 10),
  pollConcurrency: parseInt(process.env.POLL_CONCURRENCY ?? '10', 10),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  dedupTtlSec: parseInt(process.env.DEDUP_TTL_SEC ?? '604800', 10), // 7 days default
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY ?? '',
  encryptionKey: process.env.APP_ENCRYPTION_KEY ?? '',
}

if (!config.dbUrl) {
  throw new Error('Missing required environment variable: DB_URL')
}
if (!config.kafkaBroker) {
  throw new Error('Missing required environment variable: KAFKA_BROKER')
}
if (!config.appEncryptionKey) {
  throw new Error('Missing required environment variable: APP_ENCRYPTION_KEY')
}
