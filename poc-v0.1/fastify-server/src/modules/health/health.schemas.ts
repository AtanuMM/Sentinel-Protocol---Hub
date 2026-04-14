export const pingResponseSchema = {
  type: "object",
  required: ["status", "timestamp", "node_version"],
  properties: {
    status: { type: "string" },
    timestamp: { type: "string" },
    node_version: { type: "string" },
  },
};
