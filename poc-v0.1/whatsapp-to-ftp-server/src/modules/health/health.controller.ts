import { FastifyReply, FastifyRequest } from "fastify";
import { HealthService } from "./health.service";

export class HealthController {
  constructor(private readonly healthService = new HealthService()) {}

  ping = (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: "online",
      service: "whatsapp-to-ftp-server",
      timestamp: new Date().toISOString(),
      node_version: process.version,
    });
  };

  live = (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "live" });
  };

  health = async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.healthService.check();
    const statusCode = result.status === "healthy" ? 200 : 503;
    return reply.code(statusCode).send(result);
  };

  ready = async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.healthService.check();
    if (result.status !== "healthy") {
      return reply.code(503).send({
        status: "not_ready",
        checks: result.checks,
      });
    }

    return reply.send({
      status: "ready",
      dependencies: ["postgres", "redis", "kafka"],
    });
  };
}
