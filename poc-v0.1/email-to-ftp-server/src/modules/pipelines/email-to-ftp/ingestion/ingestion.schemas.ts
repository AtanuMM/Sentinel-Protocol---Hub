export const pollClaimsBodySchema = {
  type: "object",
  required: ["email", "serviceId"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    /**
     * Resets IMAP UID cursor to 0 before this run, so processing starts from the lowest UIDs (full backlog
     * walk). Use only for deliberate reprocessing; not needed when `startFromCurrentMailboxWatermark` was used
     * at registration. Dedup still applies.
     */
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
  required: [
    "success",
    "email",
    "scannedUids",
    "claimKeywordMatches",
    "pdfsIngested",
    "ingested",
    "message",
    "lastProcessedUidBefore",
    "lastProcessedUidAfter",
  ],
  properties: {
    success: { type: "boolean", const: true },
    email: { type: "string" },
    scannedUids: { type: "integer" },
    claimKeywordMatches: { type: "integer" },
    pdfsIngested: { type: "integer" },
    ingested: { type: "array", items: pollClaimsIngestedItemSchema },
    message: { type: "string" },
    lastProcessedUidBefore: {
      type: "integer",
      description: "Ingestion_Channel_Master.last_processed_uid before this poll (only UIDs greater than this are candidates).",
    },
    lastProcessedUidAfter: {
      type: "integer",
      description: "Cursor after poll (max UID in this batch, or unchanged if nothing to scan).",
    },
  },
};
