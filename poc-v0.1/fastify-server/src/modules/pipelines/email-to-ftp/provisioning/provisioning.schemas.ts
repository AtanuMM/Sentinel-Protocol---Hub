export const registerEmailSourceBodySchema = {
  type: "object",
  required: ["orgId", "serviceId", "email", "password", "imapHost"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
    zoneId: { type: "string", minLength: 1 },
    email: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    imapHost: { type: "string", minLength: 1 },
    imapPort: { type: "integer", minimum: 1, maximum: 65535, default: 993 },
    /**
     * When true (default), set `last_processed_uid` to the current max IMAP UID so polling only sees mail
     * that arrives after registration. Set false to start from the oldest message (full backlog, legacy POC).
     */
    startFromCurrentMailboxWatermark: { type: "boolean", default: true },
  },
} as const;

export const registerEmailSourceHeadersSchema = {
  type: "object",
  required: ["x-vault-token"],
  properties: {
    "x-vault-token": { type: "string", minLength: 1 },
  },
} as const;

export interface RegisterEmailSourceInput {
  orgId: string;
  serviceId: string;
  zoneId?: string;
  email: string;
  password: string;
  imapHost: string;
  imapPort?: number;
  /** @default true — skip existing inbox; only UIDs after registration. */
  startFromCurrentMailboxWatermark?: boolean;
}

export const testEmailSourceBodySchema = {
  type: "object",
  required: ["email", "serviceId"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
  },
} as const;

export interface TestEmailSourceInput {
  email: string;
  serviceId: string;
}

export const previewInboxBodySchema = {
  type: "object",
  required: ["email", "serviceId"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
    limit: { type: "integer", minimum: 1, maximum: 25 },
    maxAttachmentBytes: { type: "integer", minimum: 1024, maximum: 2097152 },
  },
} as const;

export interface PreviewInboxInput {
  email: string;
  serviceId: string;
  limit?: number;
  maxAttachmentBytes?: number;
}

export const registerEmailSourceResponseSchema = {
  type: "object",
  required: ["success", "message", "data"],
  properties: {
    success: { type: "boolean", const: true },
    message: { type: "string" },
    data: {
      type: "object",
      required: ["email", "orgId", "lastProcessedUid"],
      properties: {
        email: { type: "string" },
        orgId: { type: "string" },
        lastProcessedUid: {
          type: "integer",
          description: "Initial IMAP UID cursor (max UID in mailbox when watermark is used; 0 if disabled or empty mailbox).",
        },
      },
    },
  },
};

export const testEmailSourceResponseSchema = {
  type: "object",
  required: ["success", "email", "active", "message"],
  properties: {
    success: { type: "boolean", const: true },
    email: { type: "string" },
    active: { type: "boolean" },
    message: { type: "string" },
    detail: { type: "string" },
  },
};

export const previewInboxResponseSchema = {
  type: "object",
  required: ["success", "email", "message", "messages"],
  properties: {
    success: { type: "boolean", const: true },
    email: { type: "string" },
    message: { type: "string" },
    messages: {
      type: "array",
      items: {
        type: "object",
        required: ["uid", "body", "attachments"],
        properties: {
          uid: { type: "integer" },
          subject: { type: "string", nullable: true },
          from: { type: "string", nullable: true },
          date: { type: "string", nullable: true },
          body: {
            type: "object",
            properties: {
              text: { type: "string" },
              html: { type: "string" },
            },
          },
          attachments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                filename: { type: "string" },
                mime: { type: "string" },
                base64: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};
