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
}

export interface WhatsappRawEvent {
  orgId: string;
  zoneId: string;
  kmsServiceId: string;
  vaultToken: string;
  displayPhoneNumber: string;
  messageId: string;
  senderNumber: string;
  timestamp: string;
  messageText: string | null;
  mediaId: string;
  originalFilename: string;
  mimeType: string;
}
