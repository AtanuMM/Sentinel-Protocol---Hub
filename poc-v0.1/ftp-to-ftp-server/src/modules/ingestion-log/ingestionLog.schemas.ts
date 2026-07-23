const dateRangeProperties = {
  orgId: { type: "string", minLength: 1 },
  from: { type: "string", format: "date-time" },
  to: { type: "string", format: "date-time" },
};

export const ingestionLogQuerySchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: {
    ...dateRangeProperties,
    insuranceCompanyCode: { type: "string", minLength: 1 },
    status: { type: "string", enum: ["SUCCESS", "FAILED"] },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

export const ingestionLogSummaryQuerySchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: dateRangeProperties,
};

const bigintSchema = {
  anyOf: [{ type: "integer" }, { type: "string" }],
};

const ingestionLogRowSchema = {
  type: "object",
  required: [
    "id",
    "org_id",
    "insurance_company_code",
    "channel_type",
    "source_path",
    "landing_path",
    "file_name",
    "file_size_bytes",
    "status",
    "ingested_at",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: bigintSchema,
    org_id: { type: "string" },
    insurance_company_code: { type: "string" },
    channel_type: { type: "string" },
    source_path: { type: "string" },
    landing_path: { type: "string" },
    file_name: { type: "string" },
    file_size_bytes: bigintSchema,
    status: { type: "string", enum: ["SUCCESS", "FAILED"] },
    error_message: { type: "string", nullable: true },
    ingested_at: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const ingestionLogResponseSchema = {
  type: "object",
  required: ["success", "total", "page", "limit", "data"],
  properties: {
    success: { type: "boolean" },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
    data: { type: "array", items: ingestionLogRowSchema },
  },
};

export const ingestionLogSummaryResponseSchema = {
  type: "object",
  required: [
    "success",
    "orgId",
    "totalFiles",
    "totalSuccess",
    "totalFailed",
    "byChannel",
  ],
  properties: {
    success: { type: "boolean" },
    orgId: { type: "string" },
    totalFiles: { type: "integer" },
    totalSuccess: { type: "integer" },
    totalFailed: { type: "integer" },
    byChannel: {
      type: "array",
      items: {
        type: "object",
        required: ["channel_type", "count"],
        properties: {
          channel_type: { type: "string" },
          count: { type: "integer" },
        },
      },
    },
  },
};
