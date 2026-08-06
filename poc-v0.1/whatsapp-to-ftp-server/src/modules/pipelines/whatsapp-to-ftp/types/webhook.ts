export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: string;
}

export interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  messages?: MetaWebhookMessage[];
  statuses?: unknown[];
}

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  document?: {
    caption?: string;
    filename: string;
    id: string;
    mime_type: string;
  };
  image?: {
    caption?: string;
    id: string;
    mime_type: string;
  };
}

interface WhatsappRawEventBase {
  orgId: string;
  zoneId: string;
  kmsServiceId: string;
  vaultToken: string;
  displayPhoneNumber: string;
  messageId: string;
  senderNumber: string;
  timestamp: string;
  messageText: string | null;
}

export type WhatsappRawEvent =
  | (WhatsappRawEventBase & { messageType: "text" })
  | (WhatsappRawEventBase & {
      messageType: "document";
      mediaId: string;
      originalFilename: string;
      mimeType: string;
    })
  | (WhatsappRawEventBase & {
      messageType: "image";
      mediaId: string;
      originalFilename: string;
      mimeType: string;
    });

/** Pre-discriminator events already on the topic — treat as document when media fields are present. */
export type LegacyWhatsappRawEvent = WhatsappRawEventBase & {
  messageType?: undefined;
  mediaId: string;
  originalFilename: string;
  mimeType: string;
};

export type ParsedWhatsappRawEvent = WhatsappRawEvent | LegacyWhatsappRawEvent;

export function isMediaWhatsappRawEvent(
  event: ParsedWhatsappRawEvent,
): event is Extract<WhatsappRawEvent, { messageType: "document" | "image" }> | LegacyWhatsappRawEvent {
  if (event.messageType === "document" || event.messageType === "image") {
    return true;
  }
  return event.messageType === undefined && "mediaId" in event && Boolean(event.mediaId);
}

export function isTextWhatsappRawEvent(
  event: ParsedWhatsappRawEvent,
): event is Extract<WhatsappRawEvent, { messageType: "text" }> {
  return event.messageType === "text";
}
