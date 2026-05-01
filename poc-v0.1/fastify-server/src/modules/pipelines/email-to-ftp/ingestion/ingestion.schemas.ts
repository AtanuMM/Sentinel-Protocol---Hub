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
