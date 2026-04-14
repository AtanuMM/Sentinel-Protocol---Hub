import { FastifyReply, FastifyRequest } from "fastify";
import { MinioWebhookEvent } from "../../types/webhook";
import { IngestionService } from "./ingestion.service";

type WebhookRequest = FastifyRequest<{ Body: MinioWebhookEvent }>;

export class IngestionController {
  constructor(private readonly service: IngestionService) {}

  webhook = async (request: WebhookRequest, reply: FastifyReply) => {
    const result = await this.service.processWebhook(request.body);
    return reply.send(result);
  };
}
