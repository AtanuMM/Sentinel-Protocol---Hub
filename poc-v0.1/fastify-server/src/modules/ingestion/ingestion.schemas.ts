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
