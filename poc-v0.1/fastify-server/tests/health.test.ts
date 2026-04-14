import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const app = buildApp();

describe("health routes", () => {
  it("returns ping status", async () => {
    const response = await app.inject({ method: "GET", url: "/api/ping" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("online");
  });
});

afterAll(async () => {
  await app.close();
});
