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
          "Scans new IMAP UIDs, matches claim keywords, dedupes PDFs to landing bucket and Kafka trace events.",
        security: [{ vaultToken: [] }],
        body: pollClaimsBodySchema,
        headers: registerEmailSourceHeadersSchema,
        response: { 200: pollClaimsResponseSchema },
      },
    },
    controller.pollClaimEmails,
  );
};
