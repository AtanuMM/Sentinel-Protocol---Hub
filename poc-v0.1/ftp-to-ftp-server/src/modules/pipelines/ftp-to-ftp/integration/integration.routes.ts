import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { IntegrationService } from "./integration.service";
import { IntegrationController } from "./integration.controller";
import {
  linkBucketBodySchema,
  linkBucketHeadersSchema,
  linkBucketResponseSchema,
} from "./integration.schemas";

export const registerIntegrationRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new IntegrationController(new IntegrationService(new IngestionChannelRepository()));
  app.post(
    "/api/link-bucket",
    {
      schema: {
        tags: [openApiTags.ftpIntegration],
        summary: "Link MinIO bucket",
        description: "Stores encrypted credentials and writes hierarchy marker on the external bucket.",
        security: [{ vaultToken: [] }],
        headers: linkBucketHeadersSchema,
        body: linkBucketBodySchema,
        response: { 200: linkBucketResponseSchema },
      },
    },
    controller.linkBucket,
  );
};
