import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../../errors/appError";
import type {
  ConnectWhatsappChannelInput,
  DisconnectWhatsappChannelInput,
  ListWhatsappChannelsQuery,
} from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

type ConnectWhatsappChannelRequest = FastifyRequest<{
  Body: ConnectWhatsappChannelInput;
  Headers: { "x-vault-token": string };
}>;

type DisconnectWhatsappChannelRequest = FastifyRequest<{
  Body: DisconnectWhatsappChannelInput;
  Headers: { "x-vault-token": string };
}>;

type ListWhatsappChannelsRequest = FastifyRequest<{
  Querystring: ListWhatsappChannelsQuery;
}>;

export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  connectWhatsappChannel = async (request: ConnectWhatsappChannelRequest, reply: FastifyReply) => {
    const vaultToken = request.headers["x-vault-token"];
    if (!vaultToken) {
      throw new AppError(401, "Vault token missing from request headers", "VAULT_TOKEN_MISSING");
    }

    const result = await this.service.connectWhatsappChannel(request.body, vaultToken);
    return reply.code(201).send({
      success: true,
      message: "WhatsApp channel connected and secured.",
      data: result,
    });
  };

  listWhatsappChannels = async (request: ListWhatsappChannelsRequest, reply: FastifyReply) => {
    const result = await this.service.listWhatsappChannels(request.query.orgId);
    const n = result.channels.length;
    return reply.code(200).send({
      success: true,
      orgId: result.orgId,
      channels: result.channels,
      message:
        n === 0
          ? `No WhatsApp channels registered for organisation ${result.orgId}.`
          : `Listed ${n} WhatsApp channel(s) for ${result.orgId}.`,
    });
  };

  disconnectWhatsappChannel = async (request: DisconnectWhatsappChannelRequest, reply: FastifyReply) => {
    const vaultToken = request.headers["x-vault-token"];
    if (!vaultToken) {
      throw new AppError(401, "Vault token missing from request headers", "VAULT_TOKEN_MISSING");
    }

    const phoneNumber = request.body.phoneNumber.trim();
    await this.service.disconnectWhatsappChannel(request.body, vaultToken);
    return reply.code(200).send({
      success: true,
      message: `WhatsApp channel ${phoneNumber} disconnected.`,
      phoneNumber,
    });
  };
}
