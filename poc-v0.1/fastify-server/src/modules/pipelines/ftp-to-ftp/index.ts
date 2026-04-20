import { FastifyInstance } from "fastify";
import { registerFeedRoutes } from "./feed/feed.routes";
import { registerIngestionRoutes } from "./ingestion/ingestion.routes";
import { registerIntegrationRoutes } from "./integration/integration.routes";
import { registerProvisioningRoutes } from "./provisioning/provisioning.routes";

export const registerFtpToFtpPipeline = async (app: FastifyInstance): Promise<void> => {
  await app.register(registerIntegrationRoutes);
  await app.register(registerProvisioningRoutes);
  await app.register(registerFeedRoutes);
  await app.register(registerIngestionRoutes);
};
