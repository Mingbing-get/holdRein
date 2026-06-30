import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initPluginPackage } from ".";

describe("plugin package init", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true })
      )
    );
    temporaryDirectories.length = 0;
  });

  it("initializes a plugin package in the current directory", async () => {
    const directory = await createTemporaryDirectory("sample-plugin-");

    const result = initPluginPackage(directory);

    const folderName = basename(directory);
    const packageJson = JSON.parse(
      await readFile(join(directory, "package.json"), "utf8")
    ) as { readonly name: string };

    expect(result.packageName).toBe(`hold-rein-plugin-${folderName}`);
    expect(packageJson.name).toBe(`hold-rein-plugin-${folderName}`);
    await expect(
      readFile(join(directory, "tsconfig.json"), "utf8")
    ).resolves.toContain('"rootDir": "src"');
    await expect(
      readFile(join(directory, "vite.config.ts"), "utf8")
    ).resolves.toContain('entry: "src/server.ts"');
    await expect(
      readFile(join(directory, "vite.web.config.ts"), "utf8")
    ).resolves.toContain('entry: "src/web.ts"');
    await expect(
      readFile(join(directory, "src", "plugin-id.ts"), "utf8")
    ).resolves.toBe(`export const PLUGIN_ID = "__${folderName}__plugin";\n`);
    await expect(
      readFile(join(directory, "src", "server.ts"), "utf8")
    ).resolves.toContain("const serverPlugin: ServerPlugin.Plugin = {");
    await expect(
      readFile(join(directory, "src", "web.ts"), "utf8")
    ).resolves.toContain("const webPlugin: WebPlugin.Plugin = {");
  });

  it("initializes a named plugin package in a configured root", async () => {
    const directory = await createTemporaryDirectory("plugins-root-");

    const result = initPluginPackage(directory, {
      name: "nested-plugin",
      path: directory
    });

    const pluginDirectory = join(directory, "nested-plugin");
    const packageJson = JSON.parse(
      await readFile(join(pluginDirectory, "package.json"), "utf8")
    ) as { readonly name: string };

    expect(result.packageName).toBe("hold-rein-plugin-nested-plugin");
    expect(packageJson.name).toBe("hold-rein-plugin-nested-plugin");
    await expect(
      readFile(join(pluginDirectory, "src", "plugin-id.ts"), "utf8")
    ).resolves.toBe('export const PLUGIN_ID = "__nested-plugin__plugin";\n');
  });

  it("refuses to overwrite existing files", async () => {
    const directory = await createTemporaryDirectory("existing-plugin-");

    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "package.json"), "{}");

    expect(() => initPluginPackage(directory)).toThrow(
      "Refusing to overwrite existing file: package.json"
    );
  });

  async function createTemporaryDirectory(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
  }
});
