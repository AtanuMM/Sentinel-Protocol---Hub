export const registerEmailSourceBodySchema = {
  type: "object",
  required: ["orgId", "email", "password", "imapHost"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 1 },
    imapHost: { type: "string", minLength: 1 },
    imapPort: { type: "integer", minimum: 1, maximum: 65535, default: 993 },
  },
} as const;

export const registerEmailSourceHeadersSchema = {
  type: "object",
  required: ["x-vault-token"],
  properties: {
    "x-vault-token": { type: "string", minLength: 1 },
  },
} as const;

export interface RegisterEmailSourceInput {
  orgId: string;
  email: string;
  password: string;
  imapHost: string;
  imapPort?: number;
}
