import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { verifyWebhookSignature } from "../../../../middleware/webhookAuth";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { IngestionController } from "./ingestion.controller";
import { webhookBodySchema, webhookProcessResponseSchema } from "./ingestion.schemas";
import { IngestionService } from "./ingestion.service";

export const registerIngestionRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new IngestionController(new IngestionService(new IngestionChannelRepository()));
  app.post(
    "/api/webhook",
    {
      schema: {
        tags: [openApiTags.ftpIngestion],
        summary: "MinIO webhook",
        description:
          "Processes S3 notification payloads. When `WEBHOOK_SECRET` is set, **preHandler** requires header `x-webhook-signature` equal to HMAC-SHA256 of the raw JSON body (try-it-out must send a matching signature).",
        body: webhookBodySchema,
        response: { 200: webhookProcessResponseSchema },
      },
      preHandler: async (request) => verifyWebhookSignature(request),
    },
    controller.webhook,
  );
};
