import { FastifyInstance } from "fastify";
import { IngestionChannelRepository } from "../../repositories/ingestionChannel.repository";
import { ProvisioningController } from "./provisioning.controller";
import { provisioningBodySchema } from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

export const registerProvisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new ProvisioningController(new ProvisioningService(new IngestionChannelRepository()));
  app.post("/api/init-today", { schema: { body: provisioningBodySchema } }, controller.initToday);
  app.post("/api/onboard-org", { schema: { body: provisioningBodySchema } }, controller.onboardOrg);
};
