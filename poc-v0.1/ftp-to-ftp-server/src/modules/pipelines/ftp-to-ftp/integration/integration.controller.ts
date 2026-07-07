import { FastifyReply, FastifyRequest } from "fastify";
import { IntegrationService } from "./integration.service";

type LinkBucketRequest = FastifyRequest<{
  Headers: { "x-vault-token": string };
  Body: {
    orgId: string;
    insurance_company_code: string;
    configuration_strategy?: "DEDICATED" | "SHARED";
    zone: string;
    username?: string;
    password?: string;
    bucketName: string;
    region?: string;
    kmsServiceId: string;
    ftpHost: string;
    ftpPort?: number;
    secure?: boolean;
    provider?: string;
    projectId?: string;
    google_application_credentials?: Record<string, unknown>;
  };
}>;

export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  linkBucket = async (request: LinkBucketRequest, reply: FastifyReply) => {
    const result = await this.service.linkBucket({
      ...request.body,
      vaultToken: request.headers["x-vault-token"],
    });
    request.log.info({ orgId: request.body.orgId }, "Integration linked");
    return reply.send({ status: "success", ...result });
  };
}
