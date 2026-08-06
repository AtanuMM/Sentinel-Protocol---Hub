/**
 * FTP-to-FTP ingestion polling engine (KMS-backed source listing + Sentinel landing write).
 *
 * --------------------------------------------------------------------------------------------
 * DATA PREREQUISITES (no seed data in this repo):
 *
 * Rows in `Ingestion_Channel_Master` must have `kms_service_id` and `vault_token_encrypted`
 * populated (non-empty) after you run the Sequelize migration, or this loop will not process
 * that channel. `vault_token_encrypted` must be the org API key for KMS, encrypted with the
 * same `APP_ENCRYPTION_KEY` scheme as other encrypted columns. Populate via your own admin
 * tooling or SQL — nothing here hardcodes tenant values.
 * --------------------------------------------------------------------------------------------
 */

import pLimit from "p-limit";
import type { FastifyInstance } from "fastify";
import { listNewFiles, readFromSource, writeToLanding } from "@sentinel/storage-core";
import { config, buildStorageWriterConfig } from "../../../../config";
import { redisClient } from "../../../../infra/clients";
import type { IngestionChannel } from "../../../../models/ingestionChannel.model";
import { IngestionChannelRepository } from "../../../../repositories/ingestionChannel.repository";
import { decryptText } from "../../../../utils/crypto";
import { buildDedupKey } from "../../../../utils/dedupKey";
import type { VaultSecretListItem } from "../../../../utils/vault-client";
import { vaultClient } from "../../../../utils/vault-client";

let pollIntervalId: ReturnType<typeof setInterval> | undefined;

function pickSourceCredentialsFromVaultList(
  items: VaultSecretListItem[],
  channel: IngestionChannel,
): Record<string, any> {
  const provider = channel.channel_type.toUpperCase();
  const expectedKeyName =
    `${provider.toLowerCase()}:${channel.organisation_id}:${channel.insurance_company_code}`;

  for (const item of items) {
    const v = item.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const rec = v as Record<string, unknown>;
      const p = rec.provider;
      if (
        p === provider &&
        (provider === "MINIO" || item.keyName === expectedKeyName)
      ) {
        return rec as Record<string, any>;
      }
    }
  }
  throw new Error(
    provider === "MINIO"
      ? `No MINIO credential found for orgId=${channel.organisation_id}.`
      : `No exact KMS credential "${expectedKeyName}" found for orgId=${channel.organisation_id}.`,
  );
}

async function runPollCycle(app: FastifyInstance, channel: IngestionChannel): Promise<void> {
  const orgId = channel.organisation_id;
  const serviceId = channel.kms_service_id!.trim();
  const vaultTokenPlain = decryptText(channel.vault_token_encrypted!);

  const secrets = await vaultClient.listSecretsForService(serviceId, vaultTokenPlain);
  const sourceCredentials = {
    ...pickSourceCredentialsFromVaultList(secrets, channel),
    insuranceCompanyCode: channel.insurance_company_code,
    ...(channel.channel_type === "MINIO"
      ? {}
      : { source_prefix: channel.source_prefix ?? "" }),
  };

  const files = await listNewFiles({
    orgId,
    fileName: "",
    mimeType: "",
    fileSizeBytes: 0,
    sourceChannel: "FTP_INGESTION",
    sourceCredentials,
  });

  const pending = [];
  for (const file of files) {
    const dedupKey = buildDedupKey("ftp", orgId, file.filePath, file.fileName, "");
    const state = await redisClient.get(dedupKey);
    if (state === "processed") continue;
    pending.push(file);
  }

  const limit = pLimit(config.pollConcurrency);
  const storageConfig = buildStorageWriterConfig();
  await Promise.all(
    pending.map((file) =>
      limit(async () => {
        const dedupKey = buildDedupKey("ftp", orgId, file.filePath, file.fileName, "");
        const inserted = await redisClient.set(dedupKey, "processing", "EX", config.dedupTtlSec, "NX");
        if (inserted !== "OK") {
          return;
        }
        try {
          const stream = await readFromSource({
            orgId: file.orgId,
            fileName: file.fileName,
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
            sourceChannel: "FTP_INGESTION",
            sourceCredentials,
            filePath: file.filePath,
          });
          await writeToLanding(stream, {
            orgId: file.orgId,
            insuranceCompanyCode: file.insuranceCompanyCode,
            contextFolder: file.claimFolder,
            fileName: file.fileName,
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
            sourceChannel: "FTP_INGESTION",
          }, storageConfig);
          await redisClient.set(dedupKey, "processed", "EX", config.dedupTtlSec);
        } catch (err) {
          await redisClient.del(dedupKey);
          app.log.error({ err, orgId, filePath: file.filePath }, "ftp poll file ingest failed");
        }
      }),
    ),
  );
}

async function runPollTick(app: FastifyInstance, repo: IngestionChannelRepository): Promise<void> {
  const channels = await repo.findActiveOnboardedForPolling();
  for (const channel of channels) {
    try {
      await runPollCycle(app, channel);
    } catch (err) {
      app.log.error({ err, orgId: channel.organisation_id }, "ftp poll cycle failed for channel");
    }
  }
}

export function startPolling(app: FastifyInstance): void {
  if (pollIntervalId !== undefined) {
    return;
  }
  const repo = new IngestionChannelRepository();
  pollIntervalId = setInterval(() => {
    void runPollTick(app, repo).catch((err) => {
      app.log.error({ err }, "ftp poll tick failed");
    });
  }, config.pollIntervalMs);
}

export function stopPolling(): void {
  if (pollIntervalId !== undefined) {
    clearInterval(pollIntervalId);
    pollIntervalId = undefined;
  }
}
