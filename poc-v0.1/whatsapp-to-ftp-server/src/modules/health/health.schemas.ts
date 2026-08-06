const dependencyCheckSchema = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["up", "down"] },
    error: { type: "string" },
  },
} as const;

export const pingResponseSchema = {
  type: "object",
  required: ["status", "service", "timestamp", "node_version"],
  properties: {
    status: { type: "string" },
    service: { type: "string", description: "Which microservice answered (avoid hitting the wrong port)." },
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

export const healthResponseSchema = {
  type: "object",
  required: ["status", "service", "timestamp", "checks"],
  properties: {
    status: { type: "string", enum: ["healthy", "unhealthy"] },
    service: { type: "string", const: "whatsapp-to-ftp-server" },
    timestamp: { type: "string" },
    checks: {
      type: "object",
      required: ["postgres", "redis", "kafka"],
      properties: {
        postgres: dependencyCheckSchema,
        redis: dependencyCheckSchema,
        kafka: dependencyCheckSchema,
      },
    },
  },
};

export const readyResponseSchema = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["ready", "not_ready"] },
    dependencies: {
      type: "array",
      items: { type: "string" },
    },
    checks: {
      type: "object",
      properties: {
        postgres: dependencyCheckSchema,
        redis: dependencyCheckSchema,
        kafka: dependencyCheckSchema,
      },
    },
  },
};
