import * as Minio from "minio";
import { config } from "../../../../config";
import { AppError } from "../../../../errors/appError";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { decryptText, encryptText } from "../../../../utils/crypto";

export class ProvisioningService {
  constructor(private readonly repository: IngestionChannelRepository) {}

  async initToday(orgId: string, zone: string): Promise<{ message: string; path: string }> {
    const today = new Date().toISOString().split("T")[0];
    const targetFolder = `${orgId}/${zone}/${today}/`;
    const markerFile = `${targetFolder}.sentinel_ready`;

    const channel = await this.repository.findByOrgId(orgId);
    if (!channel) throw new AppError(404, "Organisation not found. Please link credentials first.", "NOT_FOUND");
    if (!channel.is_onboarded) throw new AppError(403, "Please initialize org hierarchy first.", "NOT_ONBOARDED");

    let decryptedSecret = channel.external_password_encrypted;
    const isLegacyPlaintext = (channel.external_password_encrypted.match(/:/g) ?? []).length !== 2;
    if (!isLegacyPlaintext) {
      decryptedSecret = decryptText(channel.external_password_encrypted);
    } else {
      await this.repository.updateEncryptedPassword(orgId, encryptText(channel.external_password_encrypted));
    }

    const tpaClient = new Minio.Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort,
      useSSL: config.minioUseSSL,
      accessKey: channel.external_username,
      secretKey: decryptedSecret,
    });

    try {
      await tpaClient.statObject(channel.source_bucket, `${orgId}/${zone}/.sentinel_root`);
    } catch {
      throw new AppError(500, "The parent folder structure was deleted in MinIO. Please re-onboard.", "ROOT_MISSING");
    }

    await tpaClient.putObject(
      channel.source_bucket,
      markerFile,
      Buffer.from(`PROVISIONED_ON_${new Date().toISOString()}`),
      undefined,
      { "content-type": "text/plain" }
    );

    return { message: `Daily partition ${today} is now active.`, path: targetFolder };
  }
}
