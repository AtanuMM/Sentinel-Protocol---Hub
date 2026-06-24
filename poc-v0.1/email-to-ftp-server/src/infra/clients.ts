import { Kafka, Producer } from "kafkajs";
import * as Minio from "minio";
import Redis from "ioredis";
import { config } from "../config";

export const minioClient = new Minio.Client({
  endPoint: config.minioEndpoint,
  port: config.minioPort,
  useSSL: config.minioUseSSL,
  accessKey: config.minioAccessKey,
  secretKey: config.minioSecretKey,
});

export const redisClient = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBrokers,
});

export const producer: Producer = kafka.producer();
