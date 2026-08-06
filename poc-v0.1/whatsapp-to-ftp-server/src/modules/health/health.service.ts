import { Kafka } from "kafkajs";
import { config } from "../../config";
import { redisClient } from "../../infra/clients";
import { sequelize } from "../../infra/db";

type DependencyStatus = "up" | "down";

export interface DependencyCheck {
  status: DependencyStatus;
  error?: string;
}

export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  service: "whatsapp-to-ftp-server";
  timestamp: string;
  checks: {
    postgres: DependencyCheck;
    redis: DependencyCheck;
    kafka: DependencyCheck;
  };
}

async function checkPostgres(): Promise<DependencyCheck> {
  try {
    await sequelize.authenticate();
    return { status: "up" };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<DependencyCheck> {
  try {
    const pong = await redisClient.ping();
    if (pong !== "PONG") {
      return { status: "down", error: `Unexpected Redis ping response: ${pong}` };
    }
    return { status: "up" };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkKafka(): Promise<DependencyCheck> {
  const kafka = new Kafka({
    clientId: `${config.kafkaClientId}-health`,
    brokers: config.kafkaBrokers,
  });
  const admin = kafka.admin();

  try {
    await admin.connect();
    await admin.fetchTopicMetadata({ topics: [config.whatsappRawEventsTopic] });
    return { status: "up" };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}

export class HealthService {
  async check(): Promise<HealthCheckResult> {
    const [postgres, redis, kafka] = await Promise.all([
      checkPostgres(),
      checkRedis(),
      checkKafka(),
    ]);

    const checks = { postgres, redis, kafka };
    const status = Object.values(checks).every((check) => check.status === "up")
      ? "healthy"
      : "unhealthy";

    return {
      status,
      service: "whatsapp-to-ftp-server",
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
