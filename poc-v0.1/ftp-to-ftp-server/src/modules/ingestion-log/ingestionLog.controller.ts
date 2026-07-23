import { FastifyReply, FastifyRequest } from "fastify";
import {
  IngestionLogListQuery,
  IngestionLogService,
  IngestionLogSummaryQuery,
} from "./ingestionLog.service";

export class IngestionLogController {
  constructor(private readonly service: IngestionLogService) {}

  list = async (
    request: FastifyRequest<{ Querystring: IngestionLogListQuery }>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.list(request.query);
    return reply.send(result);
  };

  summary = async (
    request: FastifyRequest<{ Querystring: IngestionLogSummaryQuery }>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.summary(request.query);
    return reply.send(result);
  };
}
