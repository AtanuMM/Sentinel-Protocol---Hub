import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

describe("health routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns ping status", async () => {
    const response = await app.inject({ method: "GET", url: "/api/ping" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("online");
  });

  afterAll(async () => {
    await app.close();
  });
});
