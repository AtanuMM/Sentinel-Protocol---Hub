import { FastifyInstance } from "fastify";
import { registerEmailIngestionRoutes } from "./ingestion/ingestion.routes";
import { registerProvisioningRoutes } from "./provisioning/provisioning.routes";

export const registerEmailToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  await app.register(
    async (scoped) => {
      await registerProvisioningRoutes(scoped);
      await registerEmailIngestionRoutes(scoped);
    },
    { prefix: "/api/email-to-ftp" },
  );
};
