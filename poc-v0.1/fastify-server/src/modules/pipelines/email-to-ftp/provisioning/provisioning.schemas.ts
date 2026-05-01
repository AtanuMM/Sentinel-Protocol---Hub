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
