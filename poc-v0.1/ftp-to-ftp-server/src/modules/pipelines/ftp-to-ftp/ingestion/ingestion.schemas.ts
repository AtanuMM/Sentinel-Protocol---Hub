export const webhookBodySchema = {
  type: "object",
  required: ["Records"],
  properties: {
    Records: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["s3"],
        properties: {
          s3: {
            type: "object",
            required: ["bucket", "object"],
            properties: {
              bucket: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string" } },
              },
              object: {
                type: "object",
                required: ["key", "eTag"],
                properties: { key: { type: "string" }, eTag: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
};

/** Outcomes from MinIO webhook processing (success, duplicate, ignored, etc.). */
export const webhookProcessResponseSchema = {
  oneOf: [
    {
      type: "object",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["ignored"] },
        reason: { type: "string" },
      },
    },
    {
      type: "object",
      required: ["status", "traceId", "path"],
      properties: {
        status: { type: "string", enum: ["success"] },
        traceId: { type: "string", format: "uuid" },
        path: { type: "string" },
      },
    },
  ],
};
