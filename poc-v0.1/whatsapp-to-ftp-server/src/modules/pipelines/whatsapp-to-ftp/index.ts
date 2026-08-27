import { FastifyInstance } from "fastify";
import { registerProvisioningRoutes } from "./provisioning/provisioning.routes";
import { registerWebhookRoutes } from "./webhook/webhook.routes";

export const registerWhatsappToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  await registerWebhookRoutes(app);
  await app.register(registerProvisioningRoutes, { prefix: "/whatsapp-to-ftp" });
};
