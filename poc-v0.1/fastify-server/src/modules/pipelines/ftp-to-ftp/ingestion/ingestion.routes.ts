import { FastifyInstance } from "fastify";
import { verifyWebhookSignature } from "../../../../middleware/webhookAuth";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { IngestionController } from "./ingestion.controller";
import { webhookBodySchema } from "./ingestion.schemas";
import { IngestionService } from "./ingestion.service";

export const registerIngestionRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new IngestionController(new IngestionService(new IngestionChannelRepository()));
  app.post(
    "/api/webhook",
    {
      schema: { body: webhookBodySchema },
      preHandler: async (request) => verifyWebhookSignature(request),
    },
    controller.webhook
  );
};
