import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { EmailSourceRepository } from "../../../../repositories/emailSource.repository";
import { ProvisioningController } from "./provisioning.controller";
import {
  listEmailSourcesQuerystringSchema,
  listEmailSourcesResponseSchema,
  previewInboxBodySchema,
  previewInboxResponseSchema,
  registerEmailSourceBodySchema,
  registerEmailSourceHeadersSchema,
  registerEmailSourceResponseSchema,
  testEmailSourceBodySchema,
  testEmailSourceResponseSchema,
} from "./provisioning.schemas";
import { ProvisioningService } from "./provisioning.service";

export const registerProvisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new ProvisioningController(new ProvisioningService(new EmailSourceRepository()));

  app.get(
    "/email-sources",
    {
      schema: {
        tags: [openApiTags.emailProvisioning],
        summary: "List email sources for an organisation",
        description:
          "Returns registered rows from Email_Source_Master for the given orgId. Set query includeConnectionStatus=true to run a live IMAP login per source (O(n) network calls; use sparingly). When false or omitted, each item has imap: null. orgId is caller-supplied (same trust model as registration).",
        security: [{ vaultToken: [] }],
        querystring: listEmailSourcesQuerystringSchema,
        headers: registerEmailSourceHeadersSchema,
        response: { 200: listEmailSourcesResponseSchema },
      },
    },
    controller.listEmailSources,
  );

  app.post(
    "/email-source/test",
    {
      schema: {
        tags: [openApiTags.emailProvisioning],
        summary: "Test IMAP connection",
        description: "Resolves vault credentials for the email and probes IMAP.",
        security: [{ vaultToken: [] }],
        body: testEmailSourceBodySchema,
        headers: registerEmailSourceHeadersSchema,
        response: { 200: testEmailSourceResponseSchema },
      },
    },
    controller.testEmailSource,
  );

  app.post(
    "/email-source/preview",
    {
      schema: {
        tags: [openApiTags.emailProvisioning],
        summary: "Preview INBOX",
        description: "Read-only fetch of recent messages with truncated bodies and capped attachments.",
        security: [{ vaultToken: [] }],
        body: previewInboxBodySchema,
        headers: registerEmailSourceHeadersSchema,
        response: { 200: previewInboxResponseSchema },
      },
    },
    controller.previewInbox,
  );

  app.post(
    "/email-source",
    {
      schema: {
        tags: [openApiTags.emailProvisioning],
        summary: "Register email source",
        description:
          "Onboards an email source: IMAP probe, optional max-UID watermark (default: skip existing inbox), vault secret, Postgres row.",
        security: [{ vaultToken: [] }],
        body: registerEmailSourceBodySchema,
        headers: registerEmailSourceHeadersSchema,
        response: { 201: registerEmailSourceResponseSchema },
      },
    },
    controller.registerEmailSource,
  );
};
