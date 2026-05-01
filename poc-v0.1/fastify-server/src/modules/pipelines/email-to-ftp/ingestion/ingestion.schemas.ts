export const pollClaimsBodySchema = {
  type: "object",
  required: ["email", "serviceId"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    /** POC: set true to set last_processed_uid to 0 before scanning so existing inbox mail can be reprocessed (dedup still applies). */
    resetCursor: { type: "boolean" },
  },
} as const;

export const pollClaimsIngestedItemSchema = {
  type: "object",
  required: ["traceId", "landingPath", "pdfSha256", "attachmentFilename"],
  properties: {
    traceId: { type: "string", format: "uuid" },
    landingPath: { type: "string" },
    pdfSha256: { type: "string" },
    attachmentFilename: { type: "string" },
  },
};

export const pollClaimsResponseSchema = {
  type: "object",
  required: ["success", "email", "scannedUids", "claimKeywordMatches", "pdfsIngested", "ingested", "message"],
  properties: {
    success: { type: "boolean", const: true },
    email: { type: "string" },
    scannedUids: { type: "integer" },
    claimKeywordMatches: { type: "integer" },
    pdfsIngested: { type: "integer" },
    ingested: { type: "array", items: pollClaimsIngestedItemSchema },
    message: { type: "string" },
  },
};
