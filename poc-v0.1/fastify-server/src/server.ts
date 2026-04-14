import { buildApp } from "./app";
import { config } from "./config";
import { producer, redisClient, minioClient } from "./infra/clients";
import { sequelize } from "./infra/db";

const app = buildApp();

const assertDependencies = async () => {
  await sequelize.authenticate();
  await redisClient.ping();
  await producer.connect();
  await minioClient.listBuckets();
};

const closeResources = async () => {
  await Promise.allSettled([producer.disconnect(), redisClient.quit(), sequelize.close(), app.close()]);
};

const start = async () => {
  try {
    await assertDependencies();
    await app.listen({ port: config.port, host: config.host });
    app.log.info({ port: config.port }, "Sentinel Protocol server started");
  } catch (error) {
    app.log.error(error);
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
