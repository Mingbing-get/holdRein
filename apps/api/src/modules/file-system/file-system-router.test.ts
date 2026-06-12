import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";

let rootPath = "";

describe("GET /api/v1/file-system/entries", () => {
  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "hold-rein-files-"));
    await mkdir(join(rootPath, "src"));
    await mkdir(join(rootPath, "docs"));
    await writeFile(join(rootPath, "README.md"), "hello");
    await writeFile(join(rootPath, "package.json"), "{}");
  });

  afterEach(async () => {
    await rm(rootPath, { force: true, recursive: true });
  });

  it("returns folders and files for the configured root when parentPath is omitted", async () => {
    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .get("/api/v1/file-system/entries");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        parentPath: rootPath,
        entries: [
          {
            extension: "",
            kind: "folder",
            name: "docs",
            path: join(rootPath, "docs")
          },
          {
            extension: "",
            kind: "folder",
            name: "src",
            path: join(rootPath, "src")
          },
          {
            extension: ".json",
            kind: "file",
            name: "package.json",
            path: join(rootPath, "package.json")
          },
          {
            extension: ".md",
            kind: "file",
            name: "README.md",
            path: join(rootPath, "README.md")
          }
        ]
      }
    });
  });

  it("returns entries for a provided parentPath inside the root", async () => {
    await writeFile(join(rootPath, "src", "main.ts"), "export {};");

    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .get("/api/v1/file-system/entries")
      .query({ parentPath: join(rootPath, "src") });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      parentPath: join(rootPath, "src"),
      entries: [
        {
          extension: ".ts",
          kind: "file",
          name: "main.ts",
          path: join(rootPath, "src", "main.ts")
        }
      ]
    });
  });

  it("rejects parentPath values outside the configured root", async () => {
    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .get("/api/v1/file-system/entries")
      .query({ parentPath: tmpdir() });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe("parentPath must be inside the root directory");
  });
});
