export const linkBucketBodySchema = {
  type: "object",
  required: ["orgId", "zone", "username", "password", "bucketName", "kmsServiceId", "ftpHost"],
  properties: {
    orgId: { type: "string", minLength: 2 },
    zone: { type: "string", minLength: 2 },
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    bucketName: { type: "string", minLength: 3 },
    region: { type: "string" },
    kmsServiceId: { type: "string", minLength: 1 },
    ftpHost: { type: "string", minLength: 1 },
    ftpPort: { type: "number" },
    secure: { type: "boolean" },
    provider: { type: "string", enum: ["FTP", "MINIO", "S3", "GCP", "AZURE"] },
  },
};

export const linkBucketHeadersSchema = {
  type: "object",
  required: ["x-vault-token"],
  properties: {
    "x-vault-token": { type: "string", minLength: 1 },
  },
};

export const linkBucketResponseSchema = {
  type: "object",
  required: ["status", "message", "is_onboarded"],
  properties: {
    status: { type: "string", enum: ["success"] },
    message: { type: "string" },
    is_onboarded: { type: "boolean" },
  },
};
