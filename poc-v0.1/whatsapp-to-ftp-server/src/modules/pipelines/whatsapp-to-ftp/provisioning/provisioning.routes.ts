import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { ProvisioningController } from "./provisioning.controller";
import {
  connectWhatsappChannelBodySchema,
  connectWhatsappChannelResponseSchema,
  disconnectWhatsappChannelBodySchema,
  disconnectWhatsappChannelResponseSchema,
  listWhatsappChannelsQuerySchema,
  listWhatsappChannelsResponseSchema,
  provisioningHeadersSchema,
} from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

export const registerProvisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new ProvisioningController(new ProvisioningService());

  app.post(
    "/whatsapp-channel",
    {
      schema: {
        tags: [openApiTags.whatsappProvisioning],
        summary: "Connect WhatsApp channel",
        description:
          "Meta Embedded Signup onboarding: exchanges authorization code, fetches WABA/phone, subscribes app to WABA, stores credentials in KMS and channel metadata in Postgres.",
        security: [{ vaultToken: [] }],
        body: connectWhatsappChannelBodySchema,
        headers: provisioningHeadersSchema,
        response: { 201: connectWhatsappChannelResponseSchema },
      },
    },
    controller.connectWhatsappChannel,
  );

  app.get(
    "/whatsapp-channels",
    {
      schema: {
        tags: [openApiTags.whatsappProvisioning],
        summary: "List WhatsApp channels",
        description: "Returns connected WhatsApp channels for an organisation (metadata only; no KMS calls).",
        querystring: listWhatsappChannelsQuerySchema,
        response: { 200: listWhatsappChannelsResponseSchema },
      },
    },
    controller.listWhatsappChannels,
  );

  app.post(
    "/whatsapp-channel/disconnect",
    {
      schema: {
        tags: [openApiTags.whatsappProvisioning],
        summary: "Disconnect WhatsApp channel",
        description: "Soft disconnect: sets channel status to INACTIVE. KMS secret is retained for audit.",
        security: [{ vaultToken: [] }],
        body: disconnectWhatsappChannelBodySchema,
        headers: provisioningHeadersSchema,
        response: { 200: disconnectWhatsappChannelResponseSchema },
      },
    },
    controller.disconnectWhatsappChannel,
  );
};
