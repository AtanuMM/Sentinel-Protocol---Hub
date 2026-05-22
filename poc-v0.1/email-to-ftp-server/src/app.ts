import crypto from "crypto";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import { getFastifyLoggerOptions } from "./infra/logger-options";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerSwagger } from "./plugins/swagger";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerEmailToFtpPipeline } from "./modules/pipelines/email-to-ftp";

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
  await app.register(registerEmailToFtpPipeline);

  app.get("/api/email-to-ftp", async (_request, reply) =>
    reply.send({
      service: "email-to-ftp-server",
      openApi: "/documentation",
      note: "poll-claims, preview, test, and email registration are POST + JSON + header x-vault-token. List sources: GET /api/email-to-ftp/email-sources",
    }),
  );

  app.get("/api/_sentinel", async (_request, reply) =>
    reply.send({
      service: "email-to-ftp-server",
      emailApiPrefix: "/api/email-to-ftp",
      diagnose404:
        "If another route 404s: use POST (not browser address bar), correct path, and rebuild (npm run build) if you run node dist/.",
    }),
  );

  return app;
};
