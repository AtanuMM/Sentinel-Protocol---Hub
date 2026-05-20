import crypto from "crypto";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import { getFastifyLoggerOptions } from "./infra/logger-options";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerSwagger } from "./plugins/swagger";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerEmailToFtpPipeline } from "./modules/pipelines/email-to-ftp";
import { registerFtpToFtpPipeline } from "./modules/pipelines/ftp-to-ftp";

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: getFastifyLoggerOptions(),
    genReqId: () => crypto.randomUUID(),
  });

  registerErrorHandler(app);

  await app.register(sensible);
  await app.register(cors, { origin: "*" });
  await registerSwagger(app);
  await app.register(registerHealthRoutes);
  await app.register(registerFtpToFtpPipeline);
  await app.register(registerEmailToFtpPipeline);
  return app;
};
