export const connectWhatsappChannelBodySchema = {
  type: "object",
  required: ["orgId", "serviceId", "zoneId", "authorizationCode"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
    zoneId: { type: "string", minLength: 1 },
    authorizationCode: { type: "string", minLength: 1 },
  },
} as const;

export const disconnectWhatsappChannelBodySchema = {
  type: "object",
  required: ["phoneNumber"],
  additionalProperties: false,
  properties: {
    phoneNumber: { type: "string", minLength: 1 },
  },
} as const;

export const listWhatsappChannelsQuerySchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
  },
} as const;

export const provisioningHeadersSchema = {
  type: "object",
  required: ["x-vault-token"],
  properties: {
    "x-vault-token": { type: "string", minLength: 1 },
  },
} as const;

export interface ConnectWhatsappChannelInput {
  orgId: string;
  serviceId: string;
  zoneId: string;
  authorizationCode: string;
}

export interface DisconnectWhatsappChannelInput {
  phoneNumber: string;
}

export interface ListWhatsappChannelsQuery {
  orgId: string;
}

export const connectWhatsappChannelResponseSchema = {
  type: "object",
  required: ["success", "message", "data"],
  properties: {
    success: { type: "boolean", const: true },
    message: { type: "string" },
    data: {
      type: "object",
      required: ["phoneNumber", "orgId", "wabaId"],
      properties: {
        phoneNumber: { type: "string" },
        orgId: { type: "string" },
        wabaId: { type: "string" },
      },
    },
  },
};

export const whatsappChannelListItemSchema = {
  type: "object",
  required: ["phoneNumber", "wabaId", "phoneNumberId", "zoneId", "status", "createdAt"],
  properties: {
    phoneNumber: { type: "string" },
    wabaId: { type: "string" },
    phoneNumberId: { type: "string" },
    zoneId: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
    createdAt: { type: "string" },
  },
} as const;

export const listWhatsappChannelsResponseSchema = {
  type: "object",
  required: ["success", "message", "orgId", "channels"],
  properties: {
    success: { type: "boolean", const: true },
    message: { type: "string" },
    orgId: { type: "string" },
    channels: {
      type: "array",
      items: whatsappChannelListItemSchema,
    },
  },
};

export const disconnectWhatsappChannelResponseSchema = {
  type: "object",
  required: ["success", "message"],
  properties: {
    success: { type: "boolean", const: true },
    message: { type: "string" },
    phoneNumber: { type: "string" },
  },
};

export const updateLandingStorageParamsSchema = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: { type: "integer", minimum: 1 },
  },
} as const;

export const updateLandingStorageBodySchema = {
  type: "object",
  required: ["provider", "bucket", "credentials"],
  additionalProperties: false,
  properties: {
    provider: { type: "string", enum: ["S3", "MINIO", "GCP", "AZURE"] },
    bucket: { type: "string", minLength: 1 },
    region: { type: "string" },
    endpoint: { type: "string" },
    useSSL: { type: "boolean" },
    port: { type: "integer" },
    credentials: {
      type: "object",
      additionalProperties: true,
      properties: {
        accessKeyId: { type: "string" },
        secretAccessKey: { type: "string" },
        accessKey: { type: "string" },
        secretKey: { type: "string" },
      },
    },
  },
} as const;

export interface UpdateLandingStorageInput {
  provider: "S3" | "MINIO" | "GCP" | "AZURE";
  bucket: string;
  region?: string;
  endpoint?: string;
  useSSL?: boolean;
  port?: number;
  credentials: Record<string, string | undefined>;
}

export const whatsappChannelPublicRowSchema = {
  type: "object",
  required: [
    "id",
    "orgId",
    "zoneId",
    "phoneNumber",
    "kmsServiceId",
    "wabaId",
    "phoneNumberId",
    "status",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "integer" },
    orgId: { type: "string" },
    zoneId: { type: "string" },
    phoneNumber: { type: "string" },
    kmsServiceId: { type: "string" },
    wabaId: { type: "string" },
    phoneNumberId: { type: "string" },
    status: { type: "string" },
    landingStorageProvider: { type: ["string", "null"] },
    landingBucket: { type: ["string", "null"] },
    landingRegion: { type: ["string", "null"] },
    landingEndpoint: { type: ["string", "null"] },
    landingKmsKeyName: { type: ["string", "null"] },
    landingUseSsl: { type: ["boolean", "null"] },
    landingPort: { type: ["integer", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

export const updateLandingStorageResponseSchema = {
  type: "object",
  required: ["success", "message", "data"],
  properties: {
    success: { type: "boolean", const: true },
    message: { type: "string" },
    data: whatsappChannelPublicRowSchema,
  },
};
