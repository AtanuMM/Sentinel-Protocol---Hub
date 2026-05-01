import { FastifyInstance } from "fastify";
import { EmailClaimArtifactRepository } from "../../../../repositories/emailClaimArtifact.repository";
import { EmailIngestionController } from "./ingestion.controller";
import { EmailIngestionService } from "./ingestion.service";
import { pollClaimsBodySchema } from "./ingestion.schemas";

export const registerEmailIngestionRoutes = async (app: FastifyInstance): Promise<void> => {
  const controller = new EmailIngestionController(
    new EmailIngestionService(new EmailClaimArtifactRepository()),
  );

  app.post(
    "/email-source/poll-claims",
    {
      schema: {
        body: pollClaimsBodySchema,
        headers: {
          type: "object",
          required: ["x-vault-token"],
          properties: {
            "x-vault-token": { type: "string", minLength: 1 },
          },
        },
      },
    },
    controller.pollClaimEmails,
  );
};
