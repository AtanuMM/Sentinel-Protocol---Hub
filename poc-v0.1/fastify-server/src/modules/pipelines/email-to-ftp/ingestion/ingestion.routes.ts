import { FastifyInstance } from "fastify";
import { openApiTags } from "../../../../openapi/tags";
import { EmailClaimArtifactRepository } from "../../../../repositories/emailClaimArtifact.repository";
import { EmailIngestionController } from "./ingestion.controller";
import { EmailIngestionService } from "./ingestion.service";
import { pollClaimsBodySchema, pollClaimsResponseSchema } from "./ingestion.schemas";
import { registerEmailSourceHeadersSchema } from "../provisioning/provisioning.schemas";

export const registerEmailIngestionRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new EmailIngestionController(
    new EmailIngestionService(new EmailClaimArtifactRepository()),
  );

  app.post(
    "/email-source/poll-claims",
    {
      schema: {
        tags: [openApiTags.emailIngestion],
        summary: "Poll claim emails",
        description:
          "Scans new IMAP UIDs above the stored cursor (set at registration via max UID watermark by default). When resetCursor is true, the IMAP cursor resets to 0 and Redis email dedup keys for this source are cleared so attachments can be re-ingested.",
        security: [{ vaultToken: [] }],
        body: pollClaimsBodySchema,
        headers: registerEmailSourceHeadersSchema,
        response: { 200: pollClaimsResponseSchema },
      },
    },
    controller.pollClaimEmails,
  );
};
