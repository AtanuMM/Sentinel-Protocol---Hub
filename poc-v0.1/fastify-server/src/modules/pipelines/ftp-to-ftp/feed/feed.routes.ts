import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { FeedController } from "./feed.controller";
import { liveFeedResponseSchema } from "./feed.schemas";
import { FeedService } from "./feed.service";

export const registerFeedRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new FeedController(new FeedService(new IngestionChannelRepository()));
  app.get(
    "/api/live-feed",
    {
      schema: {
        tags: [openApiTags.ftpFeed],
        summary: "Recent ingestion channels",
        description: "Returns up to five most recently updated ingestion channel rows.",
        response: { 200: liveFeedResponseSchema },
      },
    },
    controller.getLiveFeed,
  );
};
