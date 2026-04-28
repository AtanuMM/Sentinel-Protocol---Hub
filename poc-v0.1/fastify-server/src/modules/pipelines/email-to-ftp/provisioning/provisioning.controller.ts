import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../../errors/appError";
import type { RegisterEmailSourceInput } from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

type RegisterEmailSourceRequest = FastifyRequest<{
  Body: RegisterEmailSourceInput;
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
}
