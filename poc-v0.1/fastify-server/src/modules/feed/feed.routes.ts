import { FastifyInstance } from "fastify";
import { IngestionChannelRepository } from "../../repositories/ingestionChannel.repository";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";

export const registerFeedRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new FeedController(new FeedService(new IngestionChannelRepository()));
  app.get("/api/live-feed", controller.getLiveFeed);
};
