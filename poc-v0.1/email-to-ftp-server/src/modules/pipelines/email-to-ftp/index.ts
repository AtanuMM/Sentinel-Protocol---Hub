import { FastifyInstance } from "fastify";
import { registerEmailIngestionRoutes } from "./ingestion/ingestion.routes";
import { registerProvisioningRoutes } from "./provisioning/provisioning.routes";

export const registerEmailToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  /** One scoped app + one prefix avoids registering two sibling plugins with the same prefix (route visibility edge cases). */
  await app.register(
    async (scoped) => {
      await registerProvisioningRoutes(scoped);
      await registerEmailIngestionRoutes(scoped);
    },
    { prefix: "/api/email-to-ftp" },
  );
};
