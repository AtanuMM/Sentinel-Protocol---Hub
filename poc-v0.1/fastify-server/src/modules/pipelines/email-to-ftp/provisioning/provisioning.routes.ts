import { FastifyInstance } from "fastify";
import { ProvisioningController } from "./provisioning.controller";
import {
  registerEmailSourceBodySchema,
  registerEmailSourceHeadersSchema,
} from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

export const registerProvisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new ProvisioningController(new ProvisioningService());

  app.post(
    "/email-source",
    {
      schema: {
        body: registerEmailSourceBodySchema,
        headers: registerEmailSourceHeadersSchema,
      },
    },
    controller.registerEmailSource,
  );
};
