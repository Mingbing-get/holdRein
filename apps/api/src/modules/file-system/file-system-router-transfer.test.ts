import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";

let rootPath = "";

describe("POST /api/v1/file-system/files", () => {
  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "hold-rein-files-"));
    await mkdir(join(rootPath, "docs"));
  });

  afterEach(async () => {
    await rm(rootPath, { force: true, recursive: true });
  });

  it("uploads multiple files below the provided parentPath", async () => {
    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .post("/api/v1/file-system/files")
      .query({ parentPath: join(rootPath, "docs") })
      .attach("files", Buffer.from("# Hello"), "README.md")
      .attach("files", Buffer.from("notes"), "notes.txt");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        extension: ".md",
        kind: "file",
        name: "README.md",
        path: join(rootPath, "docs", "README.md")
      },
      {
        extension: ".txt",
        kind: "file",
        name: "notes.txt",
        path: join(rootPath, "docs", "notes.txt")
      }
    ]);
    await expect(readFile(join(rootPath, "docs", "README.md"), "utf8")).resolves.toBe(
      "# Hello"
    );
    await expect(readFile(join(rootPath, "docs", "notes.txt"), "utf8")).resolves.toBe(
      "notes"
    );
  });

  it("rejects parentPath values outside the configured root", async () => {
    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .post("/api/v1/file-system/files")
      .query({ parentPath: tmpdir() })
      .attach("files", Buffer.from("outside"), "outside.txt");

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe("parentPath must be inside the root directory");
  });
});

describe("GET /api/v1/file-system/files/download", () => {
  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "hold-rein-files-"));
    await mkdir(join(rootPath, "docs"));
    await writeFile(join(rootPath, "docs", "report.txt"), "download me");
  });

  afterEach(async () => {
    await rm(rootPath, { force: true, recursive: true });
  });

  it("downloads a file inside the configured root", async () => {
    const filePath = join(rootPath, "docs", "report.txt");

    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .get("/api/v1/file-system/files/download")
      .query({ filePath });

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("report.txt");
    expect(response.text).toBe("download me");
    await expect(stat(filePath)).resolves.toMatchObject({
      isFile: expect.any(Function)
    });
  });

  it("rejects filePath values outside the configured root", async () => {
    const response = await request(await createApp({ fileSystemRootPath: rootPath }))
      .get("/api/v1/file-system/files/download")
      .query({ filePath: join(tmpdir(), "outside.txt") });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe("filePath must be inside the root directory");
  });
});
