import { writeToLanding } from "@sentinel/storage-core";
import axios from "axios";
import { Consumer, Kafka } from "kafkajs";
import { Readable } from "stream";
import { config } from "../../../../config";
import { decryptText } from "../../../../utils/crypto";
import type { WhatsappRawEvent } from "../types/webhook";
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

function deriveClaimStem(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) {
    return filename;
  }
  return filename.slice(0, lastDot);
}

function deriveContextFolder(displayPhoneNumber: string, originalFilename: string): string {
  const claimStem = deriveClaimStem(originalFilename);
  return `${displayPhoneNumber}_${claimStem}`;
}

async function resolveAccessToken(event: WhatsappRawEvent): Promise<string | null> {
  const plainVaultToken = decryptText(event.vaultToken);
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
    return null;
  }

  const accessToken = secret.value.access_token;
  return typeof accessToken === "string" && accessToken.length > 0 ? accessToken : null;
}

async function processRawEvent(event: WhatsappRawEvent): Promise<void> {
  const accessToken = await resolveAccessToken(event);
  if (!accessToken) {
    console.error(
      `[media-harvester] WhatsApp secret not found for displayPhoneNumber=${event.displayPhoneNumber} messageId=${event.messageId}`,
    );
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
  const contextFolder = deriveContextFolder(event.displayPhoneNumber, event.originalFilename);

  const fileResponse = await axios.get(cdnUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: "stream",
  });

  const pdfResult = await writeToLanding(fileResponse.data as Readable, {
    orgId: event.orgId,
    zoneId: event.zoneId,
    contextFolder,
    fileName: event.originalFilename,
    mimeType: event.mimeType,
    fileSizeBytes,
    sourceChannel: WHATSAPP_SOURCE_CHANNEL,
  });

  const transcriptBuffer = await buildWhatsappTranscriptPdfBuffer({
    messageId: event.messageId,
    senderNumber: event.senderNumber,
    displayPhoneNumber: event.displayPhoneNumber,
    timestamp: event.timestamp,
    originalFilename: event.originalFilename,
    messageText: event.messageText,
  });

  const transcriptFilename = `transcript_${event.messageId}.pdf`;
  const transcriptResult = await writeToLanding(Readable.from(transcriptBuffer), {
    orgId: event.orgId,
    zoneId: event.zoneId,
    contextFolder,
    fileName: transcriptFilename,
    mimeType: "application/pdf",
    fileSizeBytes: transcriptBuffer.byteLength,
    sourceChannel: WHATSAPP_SOURCE_CHANNEL,
  });

  console.log(
    `[media-harvester] ✅ messageId=${event.messageId} uploaded pdf=${pdfResult.objectKey} transcript=${transcriptResult.objectKey}`,
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

        let event: WhatsappRawEvent | undefined;
        try {
          event = JSON.parse(message.value.toString()) as WhatsappRawEvent;
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
