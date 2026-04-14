export const provisioningBodySchema = {
  type: "object",
  required: ["orgId", "zone"],
  properties: {
    orgId: { type: "string", minLength: 2 },
    zone: { type: "string", minLength: 2 },
  },
};
