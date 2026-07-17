import { buildApp } from "./app";
import { config } from "./config";
import { producer, redisClient, minioClient } from "./infra/clients";
import { sequelize } from "./infra/db";
import {
  startMediaHarvester,
  stopMediaHarvester,
} from "./modules/pipelines/whatsapp-to-ftp/workers/media-harvester";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance | undefined;

const assertDependencies = async () => {
  await sequelize.authenticate();
  await redisClient.ping();
  await producer.connect();
  await minioClient.listBuckets();
};

const closeResources = async () => {
  await Promise.allSettled([
    stopMediaHarvester(),
    producer.disconnect(),
    redisClient.quit(),
    sequelize.close(),
    app?.close(),
  ]);
};

const start = async () => {
  try {
    app = await buildApp();
    await assertDependencies();
    await startMediaHarvester();
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      { service: "whatsapp-to-ftp-server", port: config.port, host: config.host },
      "Sentinel Protocol whatsapp-to-ftp server started — Meta webhook at /v1/whatsapp/webhook",
    );
  } catch (error) {
    if (app) {
      app.log.error(error);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  await closeResources();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeResources();
  process.exit(0);
});

void start();
