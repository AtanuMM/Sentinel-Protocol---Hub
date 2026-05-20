import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { ProvisioningController } from "./provisioning.controller";
import {
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
  const controller = new ProvisioningController(new ProvisioningService());

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
