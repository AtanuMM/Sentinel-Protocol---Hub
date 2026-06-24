import { FastifyReply, FastifyRequest } from "fastify";
import { ProvisioningService } from "./provisioning.service";

type ProvisioningRequest = FastifyRequest<{ Body: { orgId: string; zone: string } }>;

export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  initToday = async (request: ProvisioningRequest, reply: FastifyReply) => {
    const result = await this.service.initToday(request.body.orgId, request.body.zone);
    return reply.send({ status: "success", ...result });
  };

  onboardOrg = async (request: ProvisioningRequest, reply: FastifyReply) => {
    const result = await this.service.initToday(request.body.orgId, request.body.zone);
    return reply.send({ status: "success", ...result });
  };
}
