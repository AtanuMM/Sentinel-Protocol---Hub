export interface MinioWebhookEvent {
  Records?: Array<{
    s3: {
      bucket: { name: string };
      object: { key: string; eTag: string };
    };
  }>;
}
