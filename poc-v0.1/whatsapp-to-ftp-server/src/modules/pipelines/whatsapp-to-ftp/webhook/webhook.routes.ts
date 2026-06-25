import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { WebhookController } from "./webhook.controller";

export const registerWebhookRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new WebhookController();

  app.get(
    "/v1/whatsapp/webhook",
    {
      schema: {
        tags: [openApiTags.whatsappWebhook],
        summary: "Meta webhook verification",
        description:
          "Meta Cloud API GET handshake. Responds with hub.challenge when hub.verify_token matches WHATSAPP_VERIFY_TOKEN.",
        querystring: {
          type: "object",
          required: ["hub.mode", "hub.verify_token", "hub.challenge"],
          properties: {
            "hub.mode": { type: "string" },
            "hub.verify_token": { type: "string" },
            "hub.challenge": { type: "string" },
          },
        },
      },
    },
    controller.verifyWebhook,
  );

  app.post(
    "/v1/whatsapp/webhook",
    {
      schema: {
        tags: [openApiTags.whatsappWebhook],
        summary: "Meta inbound webhook",
        description:
          "Verifies X-Hub-Signature-256, publishes document messages to Kafka (whatsapp-raw-events), returns immediately.",
      },
    },
    controller.receiveWebhook,
  );
};
