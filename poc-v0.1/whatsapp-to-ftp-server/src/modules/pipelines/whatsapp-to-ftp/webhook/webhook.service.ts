import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import { config } from "../../../../config";
import { AppError } from "../../../../errors/appError";
import { producer } from "../../../../infra/clients";
import { findChannelByPhoneNumber } from "../../../../repositories/whatsappChannel.repository";
import type { MetaWebhookPayload, WhatsappRawEvent } from "../types/webhook";
import { verifyMetaSignature } from "./signature";

export interface WhatsappWebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
  body: MetaWebhookPayload;
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
        if (message.type !== "document" || !message.document) {
          continue;
        }

        const channel = await findChannelByPhoneNumber(displayPhoneNumber);
        if (!channel) {
          log.warn({ displayPhoneNumber }, "WhatsApp channel not found for inbound document; skipping message");
          continue;
        }

        const event: WhatsappRawEvent = {
          orgId: channel.org_id,
          zoneId: channel.zone_id,
          kmsServiceId: channel.kms_service_id,
          vaultToken: channel.vault_token_encrypted,
          displayPhoneNumber,
          messageId: message.id,
          senderNumber: message.from,
          timestamp: message.timestamp,
          messageText: message.text?.body ?? message.document.caption ?? null,
          mediaId: message.document.id,
          originalFilename: message.document.filename,
          mimeType: message.document.mime_type,
        };

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
          .catch((err) => log.error({ err }, "Failed to publish WhatsApp raw event to Kafka"));
      }
    }
  }

  return { received: true };
}
