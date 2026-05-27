import * as Minio from "minio";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { encryptText } from "../../../../utils/crypto";
import { vaultClient } from "../../../../utils/vault-client";
import { config } from "../../../../config";

interface LinkBucketInput {
  orgId: string;
  zone: string;
  username: string;
  password: string;
  bucketName: string;
  region?: string;
  kmsServiceId: string;
  vaultToken: string;
  ftpHost: string;
  ftpPort?: number;
  secure?: boolean;
  provider?: string;
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
      { "content-type": "text/plain" },
    );

    const keyName = `ftp:${input.orgId}`;
    const credentialValue = {
      provider: input.provider ?? "FTP",
      host: input.ftpHost,
      port: input.ftpPort ?? 21,
      user: input.username,
      password: input.password,
      secure: input.secure ?? false,
      bucket: input.bucketName,
    };
    await vaultClient.storeSecret(
      {
        serviceId: input.kmsServiceId,
        keyName,
        value: credentialValue,
      },
      input.vaultToken,
    );

    await this.repository.upsert({
      organisation_id: input.orgId,
      source_prefix: prefix,
      source_bucket: input.bucketName,
      external_username: input.username,
      external_password_encrypted: encryptText(input.password),
      region: input.region ?? input.zone,
      is_onboarded: true,
      kms_service_id: input.kmsServiceId,
      vault_token_encrypted: encryptText(input.vaultToken),
    });

    return {
      message: `Integration Linked & Folders Created for ${input.bucketName}.`,
      is_onboarded: true,
    };
  }
}
