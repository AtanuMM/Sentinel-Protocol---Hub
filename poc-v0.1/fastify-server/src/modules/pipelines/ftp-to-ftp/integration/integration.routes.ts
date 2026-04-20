import { FastifyInstance } from "fastify";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { IntegrationService } from "./integration.service";
import { IntegrationController } from "./integration.controller";
import { linkBucketBodySchema } from "./integration.schemas";

export const registerIntegrationRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new IntegrationController(new IntegrationService(new IngestionChannelRepository()));
  app.post("/api/link-bucket", { schema: { body: linkBucketBodySchema } }, controller.linkBucket);
};
