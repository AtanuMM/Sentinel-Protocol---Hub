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
  username?: string;
  password?: string;
  bucketName?: string;
  sourcePath?: string;
  region?: string;
  kmsServiceId: string;
  vaultToken: string;
  ftpHost: string;
  ftpPort?: number;
  secure?: boolean;
  provider?: string;
  projectId?: string;
  google_application_credentials?: Record<string, unknown>;
}

function resolveBucketName(provider: string, bucketName?: string): string {
  const normalized = bucketName?.trim();
  if (provider === "FTP" || provider === "SFTP") {
    return normalized || "/";
  }
  return normalized ?? bucketName ?? "";
}

function normalizeSourcePath(sourcePath?: string): string {
  const normalized = sourcePath?.trim().replace(/^\/+/, "") ?? "";
  return normalized && !normalized.endsWith("/") ? `${normalized}/` : normalized;
}

function buildCredentialValue(input: LinkBucketInput): Record<string, unknown> {
  const provider = (input.provider ?? "FTP").toUpperCase();
  const source_prefix = normalizeSourcePath(input.sourcePath);

  switch (provider) {
    case "MINIO":
      return {
        provider,
        endpoint: `http://${input.ftpHost}:${input.ftpPort ?? 9000}`,
        access_key: input.username,
        secret_key: input.password,
        bucket: input.bucketName,
        secure: input.secure ?? false,
        source_prefix,
      };
    case "S3":
      return {
        provider,
        region: input.region ?? "ap-south-1",
        access_key: input.username,
        secret_key: input.password,
        bucket: input.bucketName,
        source_prefix,
      };
    case "GCP":
      return {
        provider,
        project_id: input.projectId,
        bucket_name: input.bucketName,
        google_application_credentials: input.google_application_credentials,
        source_prefix,
      };
    case "AZURE":
      return {
        provider,
        account_name: input.username,
        account_key: input.password,
        container: input.bucketName,
        source_prefix,
      };
    case "SFTP":
      return {
        provider: "SFTP",
        host: input.ftpHost,
        port: input.ftpPort ?? 22,
        user: input.username,
        password: input.password,
        secure: input.secure ?? false,
        bucket: input.bucketName,
        source_prefix,
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
        source_prefix,
      };
  }
}

export class IntegrationService {
  constructor(private readonly repository: IngestionChannelRepository) {}

  async linkBucket(input: LinkBucketInput): Promise<{ message: string; is_onboarded: boolean }> {
    const provider = (input.provider ?? "FTP").toUpperCase();

    const existingChannels = await this.repository.findAllByOrgId(input.orgId);
    if (existingChannels.length > 0) {
      const existingKmsServiceId = existingChannels[0].kms_service_id;
      const allShareSameKmsServiceId = existingChannels.every(
        (channel) => channel.kms_service_id === existingKmsServiceId,
      );
      if (!allShareSameKmsServiceId) {
        throw new Error(
          `orgId '${input.orgId}' has channels registered under conflicting kmsServiceId values. Manual reconciliation is required before linking another channel.`,
        );
      }
      if (existingKmsServiceId && existingKmsServiceId !== input.kmsServiceId) {
        throw new Error(
          `orgId '${input.orgId}' already has channels registered under a different kmsServiceId ('${existingKmsServiceId}'). Refusing to link with a different kmsServiceId ('${input.kmsServiceId}') — this looks like a data-isolation mismatch. If this org's vault service genuinely changed, this requires manual confirmation, not a normal onboarding call.`,
        );
      }
    }

    if (provider === "GCP") {
      if (!input.projectId?.trim()) {
        throw new Error("projectId is required when provider is GCP");
      }
      if (!input.google_application_credentials) {
        throw new Error("google_application_credentials is required when provider is GCP");
      }
    } else {
      if (!input.username?.trim()) {
        throw new Error("username is required when provider is not GCP");
      }
      if (!input.password?.trim()) {
        throw new Error("password is required when provider is not GCP");
      }
    }

    const bucketName = resolveBucketName(provider, input.bucketName);
    const sourcePrefix = normalizeSourcePath(input.sourcePath);
    const prefix = `${input.orgId}/${input.insurance_company_code}/`;
    const rootMarker = `${prefix}.sentinel_root`;

    if (provider === "MINIO") {
      const tpaClient = new Minio.Client({
        endPoint: config.minioEndpoint,
        port: config.minioPort,
        useSSL: config.minioUseSSL,
        accessKey: input.username!,
        secretKey: input.password!,
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
        keyName = `s3:${input.orgId}:${input.insurance_company_code}`;
        break;
      case "GCP":
        keyName = `gcp:${input.orgId}:${input.insurance_company_code}`;
        break;
      case "AZURE":
        keyName = `azure:${input.orgId}:${input.insurance_company_code}`;
        break;
      case "SFTP":
        keyName = `sftp:${input.orgId}:${input.insurance_company_code}`;
        break;
      default:
        keyName = `ftp:${input.orgId}:${input.insurance_company_code}`;
    }
    const credentialValue = buildCredentialValue({ ...input, bucketName, sourcePath: sourcePrefix });
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
      source_prefix: sourcePrefix,
      source_bucket: bucketName,
      external_username: input.username ?? "",
      external_password_encrypted: encryptText(input.password ?? ""),
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
