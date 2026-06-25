import dotenv from "dotenv";

dotenv.config();

/** HTTP listen port from `PORT` in `.env` / process env (1–65535). */
function parsePort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid ${name}: expected integer 1-65535, got ${JSON.stringify(raw)}`);
  }
  return n;
}

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  /**
   * Swagger UI at `/documentation`. Defaults on in non-production; in production set `ENABLE_SWAGGER_UI=true` explicitly.
   * When false, raw OpenAPI JSON is still served at `/openapi.json`.
   */
  enableSwaggerUi:
    process.env.ENABLE_SWAGGER_UI === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.ENABLE_SWAGGER_UI !== "false"),
  port: parsePort("PORT", 3002),
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
  vaultUrl: required("VAULT_URL", "http://localhost:8000/api/v1"),
  /** When set, KMS list secrets uses GET {kmsBaseUrl}/api/v1/secrets/{serviceId} (overrides vaultUrl path for listSecretsForService). */
  kmsBaseUrl: (process.env.KMS_BASE_URL ?? "").trim(),
  whatsappVerifyToken: required("WHATSAPP_VERIFY_TOKEN"),
  whatsappAppSecret: required("WHATSAPP_APP_SECRET"),
  whatsappRawEventsTopic: process.env.WHATSAPP_RAW_EVENTS_TOPIC ?? "whatsapp-raw-events",
};
