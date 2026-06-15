import 'dotenv/config'

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
