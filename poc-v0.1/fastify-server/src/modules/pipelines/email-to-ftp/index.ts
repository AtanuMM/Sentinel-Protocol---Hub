import { FastifyInstance } from "fastify";
import { registerEmailIngestionRoutes } from "./ingestion/ingestion.routes";
import { registerProvisioningRoutes } from "./provisioning/provisioning.routes";

export const registerEmailToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  await app.register(registerProvisioningRoutes, { prefix: "/api/email-to-ftp" });
  await app.register(registerEmailIngestionRoutes, { prefix: "/api/email-to-ftp" });
};
