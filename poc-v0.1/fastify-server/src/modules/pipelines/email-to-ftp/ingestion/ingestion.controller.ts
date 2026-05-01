import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../../errors/appError";
import type { PollClaimsInput } from "./ingestion.service";
import { EmailIngestionService } from "./ingestion.service";

type PollClaimsRequest = FastifyRequest<{
  Body: PollClaimsInput;
  Headers: { "x-vault-token": string };
}>;

export class EmailIngestionController {
  constructor(private readonly service: EmailIngestionService) {}

  pollClaimEmails = async (request: PollClaimsRequest, reply: FastifyReply) => {
    const vaultToken = request.headers["x-vault-token"];
    if (!vaultToken) {
      throw new AppError(401, "Vault token missing from request headers", "VAULT_TOKEN_MISSING");
    }

    const result = await this.service.pollClaimEmails(request.body, vaultToken);
    return reply.code(200).send({
      success: true,
      ...result,
    });
  };
}
