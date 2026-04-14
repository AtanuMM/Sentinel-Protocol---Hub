import dotenv from "dotenv";

dotenv.config();

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  dbUrl: required("DB_URL", "postgres://postgres:postgres123@localhost:5432/sentinel_mdm"),
  redisUrl: required("REDIS_URL", "redis://localhost:6380"),
  kafkaBrokers: (process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "sentinel-core",
  minioEndpoint: process.env.MINIO_ENDPOINT ?? "localhost",
  minioPort: Number(process.env.MINIO_PORT ?? 9000),
  minioUseSSL: (process.env.MINIO_USE_SSL ?? "false") === "true",
  minioAccessKey: required("MINIO_ACCESS_KEY", "minioadmin"),
  minioSecretKey: required("MINIO_SECRET_KEY", "minioadmin"),
  landingBucket: process.env.LANDING_BUCKET ?? "sentinel-landing-bucket",
  ingestionTopic: process.env.INGESTION_TOPIC ?? "claims-ingestion-trace",
  dedupTtlSec: Number(process.env.DEDUP_TTL_SEC ?? 86400),
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  encryptionKey: required("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef"),
};
