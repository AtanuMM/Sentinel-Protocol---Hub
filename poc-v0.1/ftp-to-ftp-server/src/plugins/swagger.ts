import { readFileSync } from "node:fs";
import { join } from "node:path";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { config } from "../config";
import { openApiTags } from "../openapi/tags";

function readPackageVersion(): string {
  const pkgPath = join(__dirname, "../../package.json");
  const raw = readFileSync(pkgPath, "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Sentinel Protocol — FTP-to-FTP ingestion",
        description:
          "Fastify microservice for the FTP-to-FTP pipeline (MinIO webhook, provisioning, integration, feed). Protected routes require header **x-vault-token** (key-vault).",
        version: readPackageVersion(),
      },
      servers: [{ url: "/", description: "Current server" }],
      tags: [
        { name: openApiTags.health, description: "Liveness and readiness probes." },
        { name: openApiTags.ftpIntegration, description: "Link external MinIO bucket credentials." },
        { name: openApiTags.ftpProvisioning, description: "Daily partitions and org onboarding." },
        { name: openApiTags.ftpFeed, description: "Recent ingestion channel snapshots." },
        { name: openApiTags.ftpIngestion, description: "MinIO webhook ingestion." },
      ],
      components: {
        securitySchemes: {
          vaultToken: {
            type: "apiKey",
            in: "header",
            name: "x-vault-token",
            description: "Key vault API token (see key-vault).",
          },
        },
      },
    },
  });

  if (config.enableSwaggerUi) {
    await app.register(swaggerUi, {
      routePrefix: "/documentation",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  } else {
    app.get("/openapi.json", async (_request, reply) => {
      return reply.send(app.swagger() as Record<string, unknown>);
    });
  }
}
