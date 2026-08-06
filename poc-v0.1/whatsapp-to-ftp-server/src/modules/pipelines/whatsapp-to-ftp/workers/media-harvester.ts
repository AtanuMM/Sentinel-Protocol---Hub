import { writeToLanding } from "@sentinel/storage-core";
import axios from "axios";
import { Consumer, Kafka } from "kafkajs";
import { Readable } from "stream";
import { config, buildStorageWriterConfig } from "../../../../config";
import { decryptText } from "../../../../utils/crypto";
import { findChannelByPhoneNumber } from "../../../../repositories/whatsappChannel.repository";
import type { ParsedWhatsappRawEvent } from "../types/webhook";
import { isMediaWhatsappRawEvent, isTextWhatsappRawEvent } from "../types/webhook";
import { buildWhatsappTranscriptPdfBuffer } from "./transcript-gen";

const HARVESTER_GROUP_ID = "whatsapp-media-harvester";
const WHATSAPP_SOURCE_CHANNEL = "WHATSAPP_INGESTION";
const META_GRAPH_API_VERSION = "v20.0";

interface KmsSecretListItem {
  keyName: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

interface MetaMediaInfo {
  url: string;
  mime_type?: string;
  file_size?: number;
}

let kafkaInstance: Kafka | null = null;
let activeConsumer: Consumer | undefined;

function getKafkaInstance(): Kafka {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId: config.kafkaClientId,
      brokers: config.kafkaBrokers,
    });
  }
  return kafkaInstance;
}

async function getConsumer(groupId: string): Promise<Consumer> {
  const consumer = getKafkaInstance().consumer({ groupId });
  await consumer.connect();
  return consumer;
}

function normalizePhoneForPath(displayPhoneNumber: string): string {
  return displayPhoneNumber.replace(/\s+/g, "").replace(/^\+/, "");
}

function shortenWamid(messageId: string): string {
  return messageId.length <= 10 ? messageId : messageId.slice(-10);
}

function resolveMessageTypeLabel(event: ParsedWhatsappRawEvent): string {
  if (event.messageType) {
    return event.messageType;
  }
  if (isMediaWhatsappRawEvent(event)) {
    return "document";
  }
  return "unknown";
}

function formatHhmmssForContextFolder(timestamp: string): string {
  const epochSec = Number.parseInt(timestamp, 10);
  const d = Number.isFinite(epochSec) && epochSec > 0 ? new Date(epochSec * 1000) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function deriveContextFolder(event: ParsedWhatsappRawEvent): string {
  const phone = normalizePhoneForPath(event.displayPhoneNumber);
  const messageType = resolveMessageTypeLabel(event);
  const hhmmss = formatHhmmssForContextFolder(event.timestamp);
  return `${hhmmss}_${phone}_${messageType}_${shortenWamid(event.messageId)}`;
}

function deriveTranscriptFileName(messageId: string): string {
  return `transcript_${shortenWamid(messageId)}.pdf`;
}

function buildWhatsAppObjectMetadata(event: ParsedWhatsappRawEvent): Record<string, string> {
  return {
    "message-id": event.messageId,
    "sender-number": event.senderNumber,
    "message-type": resolveMessageTypeLabel(event),
    "display-phone-number": event.displayPhoneNumber,
  };
}

function tryPlainVaultToken(vaultToken: string): string | null {
  const parts = vaultToken.split(":");
  const looksEncrypted =
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0 &&
    /^[0-9a-f]+$/i.test(parts[0]) &&
    /^[0-9a-f]+$/i.test(parts[1]) &&
    /^[0-9a-f]+$/i.test(parts[2]);

  if (looksEncrypted) {
    return decryptText(vaultToken);
  }
  if (vaultToken.startsWith("sv_live_")) {
    return vaultToken;
  }
  return null;
}

async function resolvePlainVaultToken(event: ParsedWhatsappRawEvent): Promise<string | null> {
  const channel = await findChannelByPhoneNumber(event.displayPhoneNumber);
  const candidates: string[] = [];
  if (channel?.vault_token_encrypted) {
    candidates.push(channel.vault_token_encrypted);
  }
  if (event.vaultToken && !candidates.includes(event.vaultToken)) {
    candidates.push(event.vaultToken);
  }

  for (let i = 0; i < candidates.length; i++) {
    const plain = tryPlainVaultToken(candidates[i]);
    if (plain) {
      return plain;
    }
  }

  console.warn(
    `[media-harvester] Skipping messageId=${event.messageId}: vault_token_encrypted is not APP-encrypted (iv:tag:ciphertext) or sv_live_. ` +
      `Update whatsapp_channels for ${event.displayPhoneNumber} with encryptText(sv_live_...) from key-vault provisioning.`,
  );
  return null;
}

async function resolveAccessToken(event: ParsedWhatsappRawEvent): Promise<string | null> {
  const plainVaultToken = await resolvePlainVaultToken(event);
  if (!plainVaultToken) {
    return null;
  }
  const servicePath = encodeURIComponent(event.kmsServiceId);
  const response = await axios.get<KmsSecretListItem[]>(
    `${config.vaultUrl}/secrets/${servicePath}`,
    { headers: { "x-vault-token": plainVaultToken } },
  );

  const secret = response.data.find(
    (s) =>
      s.value?.provider === "WHATSAPP" && s.value?.phone_number === event.displayPhoneNumber,
  );

  if (!secret?.value) {
    console.error(
      `[media-harvester] WhatsApp KMS secret not found for displayPhoneNumber=${event.displayPhoneNumber} kmsServiceId=${event.kmsServiceId} messageId=${event.messageId}`,
    );
    return null;
  }

  const accessToken = secret.value.access_token;
  return typeof accessToken === "string" && accessToken.length > 0 ? accessToken : null;
}

async function writeTranscript(
  event: ParsedWhatsappRawEvent,
  contextFolder: string,
  originalFilename: string,
): Promise<string> {
  const storageConfig = buildStorageWriterConfig();
  const transcriptBuffer = await buildWhatsappTranscriptPdfBuffer({
    messageId: event.messageId,
    senderNumber: event.senderNumber,
    displayPhoneNumber: event.displayPhoneNumber,
    timestamp: event.timestamp,
    originalFilename,
    messageText: event.messageText,
  });

  const transcriptFilename = deriveTranscriptFileName(event.messageId);
  const transcriptResult = await writeToLanding(Readable.from(transcriptBuffer), {
    orgId: event.orgId,
    insuranceCompanyCode: event.zoneId,
    contextFolder,
    fileName: transcriptFilename,
    mimeType: "application/pdf",
    fileSizeBytes: transcriptBuffer.byteLength,
    sourceChannel: WHATSAPP_SOURCE_CHANNEL,
    objectMetadata: buildWhatsAppObjectMetadata(event),
  }, storageConfig);

  return transcriptResult.objectKey;
}

async function processTextEvent(event: ParsedWhatsappRawEvent): Promise<void> {
  const contextFolder = deriveContextFolder(event);
  const transcriptObjectKey = await writeTranscript(event, contextFolder, "(text message)");

  console.log(
    `[media-harvester] ✅ messageId=${event.messageId} messageType=text uploaded transcript=${transcriptObjectKey}`,
  );
}

async function processMediaEvent(event: ParsedWhatsappRawEvent): Promise<void> {
  if (!isMediaWhatsappRawEvent(event)) {
    return;
  }

  const accessToken = await resolveAccessToken(event);
  if (!accessToken) {
    return;
  }

  const mediaInfo = await axios.get<MetaMediaInfo>(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${event.mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const cdnUrl = mediaInfo.data.url;
  if (!cdnUrl) {
    throw new Error(`Meta Graph API returned no CDN URL for mediaId=${event.mediaId}`);
  }

  const fileSizeBytes =
    typeof mediaInfo.data.file_size === "number" ? mediaInfo.data.file_size : 0;
  const contextFolder = deriveContextFolder(event);
  const objectMetadata = buildWhatsAppObjectMetadata(event);

  const fileResponse = await axios.get(cdnUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: "stream",
  });

  const storageConfig = buildStorageWriterConfig();

  const mediaResult = await writeToLanding(fileResponse.data as Readable, {
    orgId: event.orgId,
    insuranceCompanyCode: event.zoneId,
    contextFolder,
    fileName: event.originalFilename,
    mimeType: event.mimeType,
    fileSizeBytes,
    sourceChannel: WHATSAPP_SOURCE_CHANNEL,
    objectMetadata,
  }, storageConfig);

  const transcriptObjectKey = await writeTranscript(event, contextFolder, event.originalFilename);

  console.log(
    `[media-harvester] ✅ messageId=${event.messageId} messageType=${event.messageType ?? "document"} uploaded media=${mediaResult.objectKey} transcript=${transcriptObjectKey}`,
  );
}

async function processRawEvent(event: ParsedWhatsappRawEvent): Promise<void> {
  if (isTextWhatsappRawEvent(event)) {
    await processTextEvent(event);
    return;
  }

  if (isMediaWhatsappRawEvent(event)) {
    await processMediaEvent(event);
    return;
  }

  const unrecognized = event as ParsedWhatsappRawEvent;
  console.warn(
    `[media-harvester] Skipping messageId=${unrecognized.messageId}: unrecognized messageType=${String(unrecognized.messageType)}`,
  );
}

export async function startMediaHarvester(): Promise<void> {
  const consumer = await getConsumer(HARVESTER_GROUP_ID);
  activeConsumer = consumer;

  await consumer.subscribe({ topic: config.whatsappRawEventsTopic, fromBeginning: false });

  console.log("[media-harvester] Consumer ready");

  void consumer
    .run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }

        let event: ParsedWhatsappRawEvent | undefined;
        try {
          event = JSON.parse(message.value.toString()) as ParsedWhatsappRawEvent;
          await processRawEvent(event);
        } catch (err) {
          const messageId = event?.messageId ?? "unknown";
          console.error(`[media-harvester] Failed to process messageId=${messageId}:`, err);
        }
      },
    })
    .catch((err) => {
      console.error("[media-harvester] Consumer run failed:", err);
    });
}

export async function stopMediaHarvester(): Promise<void> {
  if (!activeConsumer) {
    return;
  }
  await activeConsumer.stop();
  await activeConsumer.disconnect();
  activeConsumer = undefined;
}
