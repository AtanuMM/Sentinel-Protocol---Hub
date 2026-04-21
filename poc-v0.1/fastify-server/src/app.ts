import crypto from "crypto";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerEmailToFtpPipeline } from "./modules/pipelines/email-to-ftp";
import { registerFtpToFtpPipeline } from "./modules/pipelines/ftp-to-ftp";

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
  app.register(registerFtpToFtpPipeline);
  app.register(registerEmailToFtpPipeline);
  return app;
};
