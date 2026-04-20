import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { config } from "../../../../config";
import { AppError } from "../../../../errors/appError";
import { minioClient, producer, redisClient } from "../../../../infra/clients";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { MinioWebhookEvent } from "../types/webhook";

const withRetries = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  throw lastErr;
};

export class IngestionService {
  constructor(private readonly repository: IngestionChannelRepository) {}

  async processWebhook(event: MinioWebhookEvent) {
    const record = event.Records?.[0];
    if (!record) return { status: "ignored", reason: "no_records" };

    const sourceBucket = record.s3.bucket.name;
    const sourcePath = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const etag = record.s3.object.eTag;

    if (sourcePath.endsWith(".sentinel_ready") || sourcePath.endsWith(".sentinel_root")) {
      return { status: "ignored", reason: "sentinel_file" };
    }

    const pathParts = sourcePath.split("/");
    if (pathParts.length < 4) throw new AppError(400, "Invalid Path Structure", "INVALID_PATH");

    const [orgId, zoneId, folderDate] = pathParts;
    const today = new Date().toISOString().split("T")[0];
    if (folderDate !== today) throw new AppError(400, "Stale Date Partition", "STALE_DATE");

    const dedupKey = `file:dedup:${orgId}:${sourceBucket}:${sourcePath}:${etag}`;
    const dedupInserted = await redisClient.set(dedupKey, "processing", "EX", config.dedupTtlSec, "NX");
    if (dedupInserted !== "OK") {
      return { status: "ignored", reason: "duplicate" };
    }

    const channel = await this.repository.findByOrgId(orgId);
    if (!channel) throw new AppError(403, "Channel Not Registered", "CHANNEL_UNREGISTERED");

    const traceId = randomUUID();
    const landingPath = `${orgId}/${zoneId}/${today}/raw/${traceId}.pdf`;

    try {
      const dataStream = await minioClient.getObject(sourceBucket, sourcePath);
      await pipeline(dataStream, async function* (source) {
        await minioClient.putObject(config.landingBucket, landingPath, Readable.from(source));
      });

      await withRetries(async () => {
        await producer.send({
          topic: config.ingestionTopic,
          messages: [
            {
              key: orgId,
              value: JSON.stringify({
                schemaVersion: 1,
                traceId,
                orgId,
                zoneId,
                landingPath,
                originalPath: sourcePath,
                timestamp: new Date().toISOString(),
              }),
            },
          ],
        });
      });

      await redisClient.set(dedupKey, "processed", "EX", config.dedupTtlSec);
      await minioClient.removeObject(sourceBucket, sourcePath);
      return { status: "success", traceId, path: landingPath };
    } catch (error) {
      await redisClient.del(dedupKey);
      throw error;
    }
  }
}
