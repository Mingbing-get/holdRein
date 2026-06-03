import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app";

describe("GET /api/v1/health", () => {
  it("returns the health payload", async () => {
    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "api",
      status: "ok",
      version: "v1"
    });
  });
});
