import { IngestionChannelRepository } from "../../repositories/ingestionChannel.repository";

export class FeedService {
  constructor(private readonly repository: IngestionChannelRepository) {}

  getLiveFeed() {
    return this.repository.findRecent(5);
  }
}
