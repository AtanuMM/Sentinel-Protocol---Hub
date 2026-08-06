import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import { config } from "../../../../config";
import { AppError } from "../../../../errors/appError";
import { producer, redisClient } from "../../../../infra/clients";
import { findChannelByPhoneNumber } from "../../../../repositories/whatsappChannel.repository";
import type { WhatsappChannel } from "../../../../models/whatsapp-channel.model";
import type { MetaWebhookMessage, MetaWebhookPayload, WhatsappRawEvent } from "../types/webhook";
import { verifyMetaSignature } from "./signature";

export interface WhatsappWebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
  body: MetaWebhookPayload;
}

const SKIPPED_MESSAGE_TYPES = new Set([
  "audio",
  "video",
  "location",
  "interactive",
  "sticker",
  "reaction",
]);

const IMAGE_MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function deriveImageFilename(messageId: string, mimeType: string): string {
  const ext = IMAGE_MIME_EXTENSION[mimeType] ?? "bin";
  return `image_${messageId}.${ext}`;
}

function buildRawEvent(
  message: MetaWebhookMessage,
  channel: WhatsappChannel,
  displayPhoneNumber: string,
): WhatsappRawEvent | null {
  const base = {
    orgId: channel.org_id,
    zoneId: channel.zone_id,
    kmsServiceId: channel.kms_service_id,
    vaultToken: channel.vault_token_encrypted,
    displayPhoneNumber,
    messageId: message.id,
    senderNumber: message.from,
    timestamp: message.timestamp,
  };

  switch (message.type) {
    case "text": {
      if (!message.text?.body) {
        return null;
      }
      return {
        ...base,
        messageType: "text",
        messageText: message.text.body,
      };
    }
    case "document": {
      if (!message.document) {
        return null;
      }
      return {
        ...base,
        messageType: "document",
        messageText: message.document.caption ?? null,
        mediaId: message.document.id,
        originalFilename: message.document.filename,
        mimeType: message.document.mime_type,
      };
    }
    case "image": {
      if (!message.image) {
        return null;
      }
      return {
        ...base,
        messageType: "image",
        messageText: message.image.caption ?? null,
        mediaId: message.image.id,
        originalFilename: deriveImageFilename(message.id, message.image.mime_type),
        mimeType: message.image.mime_type,
      };
    }
    default:
      return null;
  }
}

async function tryClaimMessageDedup(messageId: string, log: FastifyBaseLogger): Promise<boolean> {
  const key = `whatsapp:dedup:${messageId}`;
  try {
    const result = await redisClient.set(key, "1", "EX", config.dedupTtlSec, "NX");
    if (result === null) {
      log.info({ messageId }, "Duplicate WhatsApp message skipped");
      return false;
    }
    return true;
  } catch (err) {
    log.warn({ err, messageId }, "Redis dedup unavailable; proceeding with publish");
    return true;
  }
}

function publishRawEvent(event: WhatsappRawEvent, displayPhoneNumber: string, log: FastifyBaseLogger): void {
  producer
    .send({
      topic: config.whatsappRawEventsTopic,
      messages: [
        {
          key: displayPhoneNumber,
          value: JSON.stringify(event),
        },
      ],
    })
    .catch((err) => log.error({ err, messageId: event.messageId }, "Failed to publish WhatsApp raw event to Kafka"));
}

export function handleVerification(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string,
): string | null {
  if (mode === "subscribe" && token === verifyToken) return challenge;
  return null;
}

export async function handleIncomingWebhook(
  request: WhatsappWebhookRequest,
  log: FastifyBaseLogger,
): Promise<{ received: boolean }> {
  const signatureHeader = request.headers["x-hub-signature-256"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!signature) {
    throw new AppError(403, "Webhook signature header is required", "WEBHOOK_UNAUTHORIZED");
  }

  const rawBody = request.rawBody;
  if (!rawBody) {
    throw new AppError(400, "Raw request body missing for signature verification", "RAW_BODY_MISSING");
  }

  if (!verifyMetaSignature(rawBody, signature, config.whatsappAppSecret)) {
    throw new AppError(403, "Webhook signature mismatch", "WEBHOOK_UNAUTHORIZED");
  }

  const payload = request.body;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const displayPhoneNumber = value.metadata?.display_phone_number;
      if (!displayPhoneNumber) {
        continue;
      }

      for (const message of value.messages ?? []) {
        if (SKIPPED_MESSAGE_TYPES.has(message.type)) {
          log.debug(
            { messageType: message.type, messageId: message.id },
            "Skipping unsupported WhatsApp message type",
          );
          continue;
        }

        const channel = await findChannelByPhoneNumber(displayPhoneNumber);
        if (!channel) {
          log.warn(
            { displayPhoneNumber, messageId: message.id, messageType: message.type },
            "WhatsApp channel not found for inbound message; skipping",
          );
          continue;
        }

        const event = buildRawEvent(message, channel, displayPhoneNumber);
        if (!event) {
          continue;
        }

        const shouldPublish = await tryClaimMessageDedup(message.id, log);
        if (!shouldPublish) {
          continue;
        }

        publishRawEvent(event, displayPhoneNumber, log);
      }
    }
  }

  return { received: true };
}
