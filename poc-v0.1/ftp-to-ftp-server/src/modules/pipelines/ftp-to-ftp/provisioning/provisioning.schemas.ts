export const provisioningBodySchema = {
  type: "object",
  required: ["orgId", "insurance_company_code"],
  properties: {
    orgId: { type: "string", minLength: 2 },
    insurance_company_code: { type: "string", minLength: 1 },
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
