import crypto from "crypto";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerFeedRoutes } from "./modules/feed/feed.routes";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerIngestionRoutes } from "./modules/ingestion/ingestion.routes";
import { registerIntegrationRoutes } from "./modules/integration/integration.routes";
import { registerProvisioningRoutes } from "./modules/provisioning/provisioning.routes";

export const buildApp = () => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    genReqId: () => crypto.randomUUID(),
  });

  registerErrorHandler(app);

  app.register(sensible);
  app.register(cors, { origin: "*" });
  app.register(registerHealthRoutes);
  app.register(registerIntegrationRoutes);
  app.register(registerProvisioningRoutes);
  app.register(registerFeedRoutes);
  app.register(registerIngestionRoutes);
  return app;
};
