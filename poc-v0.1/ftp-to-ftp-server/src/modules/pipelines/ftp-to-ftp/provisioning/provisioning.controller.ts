import { FastifyReply, FastifyRequest } from "fastify";
import { ProvisioningService } from "./provisioning.service";

type ProvisioningRequest = FastifyRequest<{
  Body: { orgId: string; insurance_company_code: string };
}>;

export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  initToday = async (request: ProvisioningRequest, reply: FastifyReply) => {
    const { orgId, insurance_company_code } = request.body;
    const result = await this.service.initToday(orgId, insurance_company_code);
    return reply.send({ status: "success", ...result });
  };

  onboardOrg = async (request: ProvisioningRequest, reply: FastifyReply) => {
    const { orgId, insurance_company_code } = request.body;
    const result = await this.service.initToday(orgId, insurance_company_code);
    return reply.send({ status: "success", ...result });
  };
}
