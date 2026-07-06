import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import express, { type Express } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app";

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
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true })
      )
    );
    temporaryDirectories.length = 0;
  });

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

  it("serves bundled web assets when a web assets directory is provided", async () => {
    const webAssetsDirectory = await mkdtemp(join(tmpdir(), "hold-rein-web-"));
    temporaryDirectories.push(webAssetsDirectory);
    await writeFile(
      join(webAssetsDirectory, "index.html"),
      "<!doctype html><title>Hold Rein</title>"
    );

    const app = await createApp({ webAssetsDirectory });

    const rootResponse = await request(app).get("/");
    const routeResponse = await request(app).get("/workspaces/demo");

    expect(rootResponse.status).toBe(200);
    expect(rootResponse.text).toContain("<title>Hold Rein</title>");
    expect(routeResponse.status).toBe(200);
    expect(routeResponse.text).toContain("<title>Hold Rein</title>");
  });

});
