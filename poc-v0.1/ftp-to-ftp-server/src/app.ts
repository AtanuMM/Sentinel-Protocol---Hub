import crypto from "crypto";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import { getFastifyLoggerOptions } from "./infra/logger-options";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerSwagger } from "./plugins/swagger";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerIngestionLogRoutes } from "./modules/ingestion-log/ingestionLog.routes";
import { registerFtpToFtpPipeline } from "./modules/pipelines/ftp-to-ftp";

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: getFastifyLoggerOptions(),
    genReqId: () => crypto.randomUUID(),
    ignoreTrailingSlash: true,
  });

  registerErrorHandler(app);

  await app.register(sensible);
  await app.register(cors, { origin: "*" });
  await registerSwagger(app);
  await app.register(registerHealthRoutes);
  await app.register(registerIngestionLogRoutes);
  await app.register(registerFtpToFtpPipeline);

  app.get("/api/_sentinel", async (_request, reply) =>
    reply.send({
      service: "ftp-to-ftp-server",
      hint: "There is no /api/email-to-ftp on this process. Run email-to-ftp-server for email APIs.",
      webhook: "POST /api/webhook",
      ping: "GET /api/ping",
    }),
  );

  return app;
};
