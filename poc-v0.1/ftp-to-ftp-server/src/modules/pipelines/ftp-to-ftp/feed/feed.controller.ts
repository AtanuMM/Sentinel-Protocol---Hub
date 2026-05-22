import { FastifyReply, FastifyRequest } from "fastify";
import { FeedService } from "./feed.service";

export class FeedController {
  constructor(private readonly service: FeedService) {}

  getLiveFeed = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.service.getLiveFeed();
    return reply.send(data);
  };
}
