import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverServerPluginManifests,
  parseServerPluginManifest
} from "./plugin-manifest";

describe("plugin manifests", () => {
  it("accepts package manifests with server and web exports", () => {
    expect(
      parseServerPluginManifest({
        name: "@scope/demo",
        version: "1.0.0",
        exports: {
          ".": {
            import: "./dist/server/index.js"
          },
          "./web": {
            import: "./dist/web/index.js",
            style: "./dist/style.css"
          }
        }
      })
    ).toEqual({
      id: "@scope/demo",
      name: "@scope/demo",
      packageName: "@scope/demo",
      serverEntry: "./dist/server/index.js",
      version: "1.0.0",
      webEntry: "./dist/web/index.js",
      webStyle: "./dist/style.css"
    });
  });

  it("rejects missing server entries", () => {
    expect(() =>
      parseServerPluginManifest({
        name: "@scope/demo",
        version: "1.0.0",
        exports: {
          "./web": "./dist/web/index.js"
        }
      })
    ).toThrow('Plugin package "exports" must define a server entry.');
  });

  it("accepts package manifests with root conditional exports", () => {
    expect(
      parseServerPluginManifest({
        name: "@scope/server-only",
        version: "1.0.0",
        exports: {
          import: "./dist/index.js"
        }
      }).serverEntry
    ).toBe("./dist/index.js");
  });

  it("discovers direct plugin directory package manifests", async () => {
    const root = await mkdtemp(join(tmpdir(), "hold-rein-plugin-"));
    const dir = join(root, "@scope__demo");

    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "package.json"), "{}");

    await expect(discoverServerPluginManifests(root)).resolves.toEqual([
      join(dir, "package.json")
    ]);
  });
});
