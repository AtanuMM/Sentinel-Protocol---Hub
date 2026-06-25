import { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../../../../config";
import {
  handleIncomingWebhook,
  handleVerification,
  type WhatsappWebhookRequest,
} from "./webhook.service";

type WebhookVerificationRequest = FastifyRequest<{
  Querystring: {
    "hub.mode": string;
    "hub.verify_token": string;
    "hub.challenge": string;
  };
}>;

export class WebhookController {
  verifyWebhook = async (request: WebhookVerificationRequest, reply: FastifyReply) => {
    const mode = request.query["hub.mode"];
    const token = request.query["hub.verify_token"];
    const challenge = request.query["hub.challenge"];

    const result = handleVerification(mode, token, challenge, config.whatsappVerifyToken);
    if (!result) {
      return reply.code(403).send({ error: "FORBIDDEN", detail: "Webhook verification failed" });
    }

    return reply.type("text/plain").code(200).send(result);
  };

  receiveWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    await handleIncomingWebhook(request as WhatsappWebhookRequest, request.log);
    return reply.code(200).send({ status: "EVENT_RECEIVED" });
  };
}
