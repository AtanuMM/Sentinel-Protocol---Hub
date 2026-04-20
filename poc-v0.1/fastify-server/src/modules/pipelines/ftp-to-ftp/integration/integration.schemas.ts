export const linkBucketBodySchema = {
  type: "object",
  required: ["orgId", "zone", "username", "password", "bucketName"],
  properties: {
    orgId: { type: "string", minLength: 2 },
    zone: { type: "string", minLength: 2 },
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    bucketName: { type: "string", minLength: 3 },
    region: { type: "string" },
  },
};
