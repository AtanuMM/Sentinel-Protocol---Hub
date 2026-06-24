import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { ProvisioningController } from "./provisioning.controller";
import { ftpProvisioningSuccessSchema, provisioningBodySchema } from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

export const registerProvisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new ProvisioningController(new ProvisioningService(new IngestionChannelRepository()));
  app.post(
    "/api/init-today",
    {
      schema: {
        tags: [openApiTags.ftpProvisioning],
        summary: "Initialize today's partition",
        description: "Creates `.sentinel_ready` marker for today's date folder on the linked bucket.",
        body: provisioningBodySchema,
        response: { 200: ftpProvisioningSuccessSchema },
      },
    },
    controller.initToday,
  );
  app.post(
    "/api/onboard-org",
    {
      schema: {
        tags: [openApiTags.ftpProvisioning],
        summary: "Onboard organisation",
        description: "Same provisioning flow as init-today for POC.",
        body: provisioningBodySchema,
        response: { 200: ftpProvisioningSuccessSchema },
      },
    },
    controller.onboardOrg,
  );
};
