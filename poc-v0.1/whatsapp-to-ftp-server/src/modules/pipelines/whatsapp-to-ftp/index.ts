import { FastifyInstance } from "fastify";
import { registerWebhookRoutes } from "./webhook/webhook.routes";

export const registerWhatsappToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  await registerWebhookRoutes(app);
};
