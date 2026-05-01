import { FastifyInstance } from "fastify";
import { openApiTags } from "../../openapi/tags";
import { HealthController } from "./health.controller";
import { liveResponseSchema, pingResponseSchema, readyResponseSchema } from "./health.schemas";

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new HealthController();
  app.get(
    "/api/ping",
    {
      schema: {
        tags: [openApiTags.health],
        summary: "Ping",
        description: "Basic availability with node version and timestamp.",
        response: { 200: pingResponseSchema },
      },
    },
    controller.ping,
  );
  app.get(
    "/api/health/live",
    {
      schema: {
        tags: [openApiTags.health],
        summary: "Liveness",
        description: "Kubernetes-style liveness probe (no dependency checks).",
        response: { 200: liveResponseSchema },
      },
    },
    controller.live,
  );
  app.get(
    "/api/health/ready",
    {
      schema: {
        tags: [openApiTags.health],
        summary: "Readiness",
        description: "Checks Postgres and Redis connectivity.",
        response: { 200: readyResponseSchema },
      },
    },
    controller.ready,
  );
};
