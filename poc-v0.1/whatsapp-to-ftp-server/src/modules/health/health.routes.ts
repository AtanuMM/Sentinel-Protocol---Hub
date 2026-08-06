import { FastifyInstance } from "fastify";
import { openApiTags } from "../../openapi/tags";
import { HealthController } from "./health.controller";
import {
  healthResponseSchema,
  liveResponseSchema,
  pingResponseSchema,
  readyResponseSchema,
} from "./health.schemas";

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new HealthController();

  app.get(
    "/ping",
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
    "/health",
    {
      schema: {
        tags: [openApiTags.health],
        summary: "Health check",
        description: "Checks Postgres, Redis, and Kafka. Returns 200 when healthy, 503 when unhealthy.",
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    controller.health,
  );

  app.get(
    "/health/live",
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
    "/health/ready",
    {
      schema: {
        tags: [openApiTags.health],
        summary: "Readiness",
        description: "Checks Postgres, Redis, and Kafka connectivity. Returns 503 when not ready.",
        response: { 200: readyResponseSchema, 503: readyResponseSchema },
      },
    },
    controller.ready,
  );
};
