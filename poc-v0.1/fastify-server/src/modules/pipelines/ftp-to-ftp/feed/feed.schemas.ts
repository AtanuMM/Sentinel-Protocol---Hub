/** Live-feed rows from recent ingestion channels (Sequelize plain objects). */

export const ingestionChannelRowSchema = {
  type: "object",
  properties: {
    organisation_id: { type: "string" },
    source_prefix: { type: "string" },
    source_bucket: { type: "string" },
    external_username: { type: "string" },
    region: { type: "string" },
    is_onboarded: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const liveFeedResponseSchema = {
  type: "array",
  items: ingestionChannelRowSchema,
};
