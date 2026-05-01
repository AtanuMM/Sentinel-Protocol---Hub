import { FastifyInstance } from "fastify";
import { ProvisioningController } from "./provisioning.controller";
import {
  previewInboxBodySchema,
  registerEmailSourceBodySchema,
  registerEmailSourceHeadersSchema,
  testEmailSourceBodySchema,
} from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

export const registerProvisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new ProvisioningController(new ProvisioningService());

  app.post(
    "/email-source/test",
    {
      schema: {
        body: testEmailSourceBodySchema,
        headers: registerEmailSourceHeadersSchema,
      },
    },
    controller.testEmailSource,
  );

  app.post(
    "/email-source/preview",
    {
      schema: {
        body: previewInboxBodySchema,
        headers: registerEmailSourceHeadersSchema,
      },
    },
    controller.previewInbox,
  );

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
