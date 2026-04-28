import { FastifyInstance } from "fastify";
import { registerProvisioningRoutes } from "./provisioning/provisioning.routes";

export const registerEmailToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  await app.register(registerProvisioningRoutes, { prefix: "/api/email-to-ftp" });
};
