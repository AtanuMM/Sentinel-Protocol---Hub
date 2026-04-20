import * as Minio from "minio";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { encryptText } from "../../../../utils/crypto";
import { config } from "../../../../config";

interface LinkBucketInput {
  orgId: string;
  zone: string;
  username: string;
  password: string;
  bucketName: string;
  region?: string;
}

export class IntegrationService {
  constructor(private readonly repository: IngestionChannelRepository) {}

  async linkBucket(input: LinkBucketInput): Promise<{ message: string; is_onboarded: boolean }> {
    const prefix = `${input.orgId}/${input.zone}/`;
    const rootMarker = `${prefix}.sentinel_root`;

    const tpaClient = new Minio.Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort,
      useSSL: config.minioUseSSL,
      accessKey: input.username,
      secretKey: input.password,
    });

    await tpaClient.putObject(
      input.bucketName,
      rootMarker,
      Buffer.from("HIERARCHY_INITIALIZED"),
      undefined,
      { "content-type": "text/plain" }
    );

    await this.repository.upsert({
      organisation_id: input.orgId,
      source_prefix: prefix,
      source_bucket: input.bucketName,
      external_username: input.username,
      external_password_encrypted: encryptText(input.password),
      region: input.region ?? input.zone,
      is_onboarded: true,
    });

    return {
      message: `Integration Linked & Folders Created for ${input.bucketName}.`,
      is_onboarded: true,
    };
  }
}
