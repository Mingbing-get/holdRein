import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorMiddleware } from "./middleware/error-middleware";
import { notFoundMiddleware } from "./middleware/not-found-middleware";

function createErrorApp(): Express {
  const app = express();

  app.get("/boom", () => {
    throw new Error("Boom");
  });
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

describe("API response envelope", () => {
  it("returns the standard not found payload", async () => {
    const response = await request(createErrorApp()).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 40400,
      msg: "Not Found",
      data: null
    });
  });

  it("returns the standard internal error payload", async () => {
    const response = await request(createErrorApp()).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: 50000,
      msg: "Boom",
      data: null
    });
  });
});
