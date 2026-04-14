import { FastifyRequest } from "fastify";
import { config } from "../config";
import { AppError } from "../errors/appError";
import { hmacSha256 } from "../utils/crypto";

export const verifyWebhookSignature = (request: FastifyRequest): void => {
  if (!config.webhookSecret) {
    return;
  }

  const signatureHeader = request.headers["x-webhook-signature"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!signature) {
    throw new AppError(401, "Webhook signature header is required", "WEBHOOK_UNAUTHORIZED");
  }

  const payload = JSON.stringify(request.body ?? {});
  const expected = hmacSha256(payload, config.webhookSecret);
  if (signature !== expected) {
    throw new AppError(401, "Webhook signature mismatch", "WEBHOOK_UNAUTHORIZED");
  }
};
