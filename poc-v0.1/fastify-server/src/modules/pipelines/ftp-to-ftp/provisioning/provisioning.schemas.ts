export const provisioningBodySchema = {
  type: "object",
  required: ["orgId", "zone"],
  properties: {
    orgId: { type: "string", minLength: 2 },
    zone: { type: "string", minLength: 2 },
  },
};

export const ftpProvisioningSuccessSchema = {
  type: "object",
  required: ["status", "message", "path"],
  properties: {
    status: { type: "string", enum: ["success"] },
    message: { type: "string" },
    path: { type: "string" },
  },
};
