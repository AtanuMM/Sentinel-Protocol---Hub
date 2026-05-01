import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../../errors/appError";
import type {
  PreviewInboxInput,
  RegisterEmailSourceInput,
  TestEmailSourceInput,
} from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

type RegisterEmailSourceRequest = FastifyRequest<{
  Body: RegisterEmailSourceInput;
  Headers: { "x-vault-token": string };
}>;

type TestEmailSourceRequest = FastifyRequest<{
  Body: TestEmailSourceInput;
  Headers: { "x-vault-token": string };
}>;

type PreviewInboxRequest = FastifyRequest<{
  Body: PreviewInboxInput;
  Headers: { "x-vault-token": string };
}>;

export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  registerEmailSource = async (request: RegisterEmailSourceRequest, reply: FastifyReply) => {
    const vaultToken = request.headers["x-vault-token"];
    if (!vaultToken) {
      throw new AppError(401, "Vault token missing from request headers", "VAULT_TOKEN_MISSING");
    }

    const result = await this.service.registerEmailSource(request.body, vaultToken);
    return reply.code(201).send({
      success: true,
      message: "Email source onboarded and secured.",
      data: result,
    });
  };

  testEmailSource = async (request: TestEmailSourceRequest, reply: FastifyReply) => {
    const vaultToken = request.headers["x-vault-token"];
    if (!vaultToken) {
      throw new AppError(401, "Vault token missing from request headers", "VAULT_TOKEN_MISSING");
    }

    const emailTrimmed = request.body.email.trim();
    const result = await this.service.testEmailSourceConnection(request.body, vaultToken);
    return reply.code(200).send({
      success: true,
      email: emailTrimmed,
      active: result.active,
      message: result.active
        ? `IMAP connection verified for ${emailTrimmed}.`
        : `IMAP connection check failed for ${emailTrimmed}.`,
      ...(result.detail ? { detail: result.detail } : {}),
    });
  };

  previewInbox = async (request: PreviewInboxRequest, reply: FastifyReply) => {
    const vaultToken = request.headers["x-vault-token"];
    if (!vaultToken) {
      throw new AppError(401, "Vault token missing from request headers", "VAULT_TOKEN_MISSING");
    }

    const emailTrimmed = request.body.email.trim();
    const result = await this.service.previewInbox(request.body, vaultToken);
    const n = result.messages.length;
    return reply.code(200).send({
      success: true,
      email: emailTrimmed,
      message:
        n === 0
          ? `No messages in INBOX for ${emailTrimmed}.`
          : `Fetched ${n} recent message(s) from INBOX for ${emailTrimmed}.`,
      messages: result.messages,
    });
  };
}
