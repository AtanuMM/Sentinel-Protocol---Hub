/**
 * Manual verification for buildStorageWriterConfigForChannel().
 *
 * Usage:
 *   npx tsx scripts/test-landing-storage-config.ts success
 *   npx tsx scripts/test-landing-storage-config.ts fail-closed
 */
import dotenv from "dotenv";
import type { StorageWriterConfig } from "@sentinel/storage-core";
import { buildStorageWriterConfigForChannel } from "../src/config";
import { sequelize } from "../src/infra/db";
import { findChannelById, findAllByOrgId } from "../src/repositories/whatsappChannel.repository";

dotenv.config();

function summarizeConfig(config: StorageWriterConfig): Record<string, unknown> {
  const summary = { ...config } as Record<string, unknown>;
  if ("accessKeyId" in summary) summary.accessKeyId = "***REDACTED***";
  if ("secretAccessKey" in summary) summary.secretAccessKey = "***REDACTED***";
  if ("accessKey" in summary) summary.accessKey = "***REDACTED***";
  if ("secretKey" in summary) summary.secretKey = "***REDACTED***";
  return summary;
}

async function resolveTestChannelId(): Promise<number> {
  const fromArg = process.argv[3];
  if (fromArg) {
    const id = Number(fromArg);
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`Invalid channel id argument: ${fromArg}`);
    }
    return id;
  }

  const rows = await findAllByOrgId("TPA_TEST_001");
  if (rows.length === 0) {
    throw new Error("No whatsapp_channels row found for org_id TPA_TEST_001");
  }
  return rows[0].id;
}

async function runSuccessCase(channelId: number): Promise<void> {
  const channel = await findChannelById(channelId);
  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }

  const config = await buildStorageWriterConfigForChannel(channel);
  console.log("[success] buildStorageWriterConfigForChannel returned:");
  console.log(JSON.stringify(summarizeConfig(config), null, 2));
}

async function runFailClosedCase(channelId: number): Promise<void> {
  const channel = await findChannelById(channelId);
  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }

  const { decryptText } = await import("../src/utils/crypto");
  const plainVaultToken = decryptText(channel.vault_token_encrypted);
  const axios = (await import("axios")).default;
  const emptyService = await axios.post(
    `${process.env.VAULT_URL ?? "http://localhost:8000/api/v1"}/services`,
    { name: `Landing-Fail-Closed-${Date.now()}`, description: "No LANDING secrets stored here" },
    { headers: { "x-vault-token": plainVaultToken } },
  );

  const probe = channel.get({ plain: true }) as typeof channel;
  probe.landing_storage_provider = "S3";
  probe.landing_bucket = "probe-missing-landing-secret-bucket";
  probe.landing_region = "ap-south-1";
  probe.kms_service_id = emptyService.data.id;

  try {
    await buildStorageWriterConfigForChannel(probe);
    throw new Error("[fail-closed] expected throw but call succeeded");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("no LANDING secret found in KMS")) {
      throw err;
    }
    console.log("[fail-closed] correctly refused with:");
    console.log(message);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "success" && mode !== "fail-closed") {
    console.error("Usage: npx tsx scripts/test-landing-storage-config.ts <success|fail-closed> [channelId]");
    process.exit(1);
  }

  await sequelize.authenticate();
  const channelId = await resolveTestChannelId();
  console.log(`Using whatsapp_channels.id=${channelId}`);

  if (mode === "success") {
    await runSuccessCase(channelId);
    return;
  }

  await runFailClosedCase(channelId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
