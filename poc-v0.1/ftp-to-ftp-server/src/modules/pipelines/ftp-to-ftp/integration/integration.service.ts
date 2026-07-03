import * as Minio from "minio";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { encryptText } from "../../../../utils/crypto";
import { vaultClient } from "../../../../utils/vault-client";
import { config } from "../../../../config";

interface LinkBucketInput {
  orgId: string;
  insurance_company_code: string;
  configuration_strategy?: "DEDICATED" | "SHARED";
  zone: string;
  username: string;
  password: string;
  bucketName?: string;
  region?: string;
  kmsServiceId: string;
  vaultToken: string;
  ftpHost: string;
  ftpPort?: number;
  secure?: boolean;
  provider?: string;
}

function resolveBucketName(provider: string, bucketName?: string): string {
  const normalized = bucketName?.trim();
  if (provider === "FTP" || provider === "SFTP") {
    return normalized || "/";
  }
  return normalized ?? bucketName ?? "";
}

function buildCredentialValue(input: LinkBucketInput): Record<string, unknown> {
  const provider = (input.provider ?? "FTP").toUpperCase();

  switch (provider) {
    case "MINIO":
      return {
        provider,
        endpoint: `http://${input.ftpHost}:${input.ftpPort ?? 9000}`,
        access_key: input.username,
        secret_key: input.password,
        bucket: input.bucketName,
        secure: input.secure ?? false,
      };
    case "S3":
      return {
        provider,
        region: input.region ?? "ap-south-1",
        access_key: input.username,
        secret_key: input.password,
        bucket: input.bucketName,
      };
    case "GCP":
      return {
        provider,
        project_id: input.ftpHost,
        access_key: input.username,
        secret_key: input.password,
        bucket: input.bucketName,
      };
    case "AZURE":
      return {
        provider,
        account_name: input.username,
        account_key: input.password,
        container: input.bucketName,
      };
    case "FTP":
    default:
      return {
        provider: "FTP",
        host: input.ftpHost,
        port: input.ftpPort ?? 21,
        user: input.username,
        password: input.password,
        secure: input.secure ?? false,
        bucket: input.bucketName,
      };
  }
}

export class IntegrationService {
  constructor(private readonly repository: IngestionChannelRepository) {}

  async linkBucket(input: LinkBucketInput): Promise<{ message: string; is_onboarded: boolean }> {
    const provider = (input.provider ?? "FTP").toUpperCase();
    const bucketName = resolveBucketName(provider, input.bucketName);
    const prefix = `${input.orgId}/${input.insurance_company_code}/`;
    const rootMarker = `${prefix}.sentinel_root`;

    if (provider === "MINIO") {
      const tpaClient = new Minio.Client({
        endPoint: config.minioEndpoint,
        port: config.minioPort,
        useSSL: config.minioUseSSL,
        accessKey: input.username,
        secretKey: input.password,
      });

      await tpaClient.putObject(
        bucketName,
        rootMarker,
        Buffer.from("HIERARCHY_INITIALIZED"),
        undefined,
        { "content-type": "text/plain" },
      );
    }

    let keyName: string;
    switch (provider) {
      case "MINIO":
        keyName = `ftp:${input.orgId}`;
        break;
      case "S3":
        keyName = `s3:${input.orgId}`;
        break;
      case "GCP":
        keyName = `gcp:${input.orgId}`;
        break;
      case "AZURE":
        keyName = `azure:${input.orgId}`;
        break;
      case "SFTP":
        keyName = `sftp:${input.orgId}`;
        break;
      default:
        keyName = `ftp:${input.orgId}`;
    }
    const credentialValue = buildCredentialValue({ ...input, bucketName });
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
      insurance_company_code: input.insurance_company_code,
      channel_type: provider,
      configuration_strategy: input.configuration_strategy ?? "DEDICATED",
      source_prefix: prefix,
      source_bucket: bucketName,
      external_username: input.username,
      external_password_encrypted: encryptText(input.password),
      region: input.region ?? input.zone,
      is_onboarded: true,
      kms_service_id: input.kmsServiceId,
      vault_token_encrypted: encryptText(input.vaultToken),
    });

    return {
      message: `Integration Linked & Folders Created for ${bucketName}.`,
      is_onboarded: true,
    };
  }
}
