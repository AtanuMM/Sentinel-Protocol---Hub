import { FastifyReply, FastifyRequest } from "fastify";
import { redisClient } from "../../infra/clients";
import { sequelize } from "../../infra/db";

export class HealthController {
  ping(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      status: "online",
      timestamp: new Date().toISOString(),
      node_version: process.version,
    });
  }

  live(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: "live" });
  }

  async ready(_request: FastifyRequest, reply: FastifyReply) {
    await sequelize.authenticate();
    await redisClient.ping();
    return reply.send({ status: "ready", dependencies: ["postgres", "redis", "kafka_connected_at_boot"] });
  }
}
