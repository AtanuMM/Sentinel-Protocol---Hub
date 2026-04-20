import { FastifyInstance } from "fastify";
import { HealthController } from "./health.controller";
import { pingResponseSchema } from "./health.schemas";

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new HealthController();
  app.get("/api/ping", { schema: { response: { 200: pingResponseSchema } } }, controller.ping);
  app.get("/api/health/live", controller.live);
  app.get("/api/health/ready", controller.ready);
};
