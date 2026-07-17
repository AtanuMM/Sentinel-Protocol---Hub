import crypto from "crypto";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import { getFastifyLoggerOptions } from "./infra/logger-options";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerSwagger } from "./plugins/swagger";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerWhatsappToFtpPipeline } from "./modules/pipelines/whatsapp-to-ftp";

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: getFastifyLoggerOptions(),
    genReqId: () => crypto.randomUUID(),
    ignoreTrailingSlash: true,
  });

  // Must be registered BEFORE any routes — preserves raw bytes for Meta signature verification
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    try {
      const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
      (req as { rawBody?: Buffer }).rawBody = rawBody;
      done(null, JSON.parse(rawBody.toString()));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  registerErrorHandler(app);

  await app.register(sensible);
  await app.register(cors, { origin: "*" });
  await registerSwagger(app);
  await app.register(registerHealthRoutes);
  await app.register(registerWhatsappToFtpPipeline);

  app.get("/api/whatsapp-to-ftp", async (_request, reply) =>
    reply.send({
      service: "whatsapp-to-ftp-server",
      openApi: "/documentation",
      note: "Meta webhook: GET/POST /v1/whatsapp/webhook. Provisioning: POST /api/whatsapp-to-ftp/whatsapp-channel (x-vault-token).",
    }),
  );

  app.get("/api/_sentinel", async (_request, reply) =>
    reply.send({
      service: "whatsapp-to-ftp-server",
      whatsappWebhook: "/v1/whatsapp/webhook",
      diagnose404:
        "If another route 404s: use correct path, and rebuild (npm run build) if you run node dist/.",
    }),
  );

  return app;
};
