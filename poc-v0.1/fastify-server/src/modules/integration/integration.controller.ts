import { FastifyReply, FastifyRequest } from "fastify";
import { IntegrationService } from "./integration.service";

type LinkBucketRequest = FastifyRequest<{
  Body: {
    orgId: string;
    zone: string;
    username: string;
    password: string;
    bucketName: string;
    region?: string;
  };
}>;

export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  linkBucket = async (request: LinkBucketRequest, reply: FastifyReply) => {
    const result = await this.service.linkBucket(request.body);
    request.log.info({ orgId: request.body.orgId }, "Integration linked");
    return reply.send({ status: "success", ...result });
  };
}
