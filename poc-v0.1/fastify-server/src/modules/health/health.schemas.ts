export const pingResponseSchema = {
  type: "object",
  required: ["status", "timestamp", "node_version"],
  properties: {
    status: { type: "string" },
    timestamp: { type: "string" },
    node_version: { type: "string" },
  },
};

export const liveResponseSchema = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["live"] },
  },
};

export const readyResponseSchema = {
  type: "object",
  required: ["status", "dependencies"],
  properties: {
    status: { type: "string", enum: ["ready"] },
    dependencies: {
      type: "array",
      items: { type: "string" },
    },
  },
};
