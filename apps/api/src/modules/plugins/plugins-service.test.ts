import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPluginsService } from "./plugins-service";

describe("plugins service", () => {
  let pluginRoot: string;

  beforeEach(async () => {
    pluginRoot = await mkdtemp(join(tmpdir(), "hold-rein-plugins-"));
  });

  afterEach(async () => {
    await rm(pluginRoot, { force: true, recursive: true });
  });

  it("lists installed plugins as enabled unless the config disables them", async () => {
    await createPluginPackage("@scope/demo", "1.0.0");
    await writeFile(
      join(pluginRoot, "plugins.json"),
      JSON.stringify({ "@scope/demo": { disabled: true } }),
      "utf8"
    );

    const service = createPluginsService({ pluginRoot });

    await expect(service.listPlugins()).resolves.toEqual([
      expect.objectContaining({
        disabled: true,
        id: "@scope/demo",
        name: "@scope/demo",
        packageName: "@scope/demo"
      })
    ]);
    await expect(service.listDisabledPluginIds()).resolves.toEqual([
      "@scope/demo"
    ]);
  });

  it("merges active development manifests after installed manifests", async () => {
    await createPluginPackage("@scope/demo", "1.0.0");
    const service = createPluginsService({
      pluginRoot,
      runtimePluginManifests: () => [
        {
          dev: true,
          id: "@scope/demo",
          name: "@scope/demo",
          packageName: "@scope/demo",
          version: "0.0.0",
          webEntry: "http://127.0.0.1:5178/src/web.ts",
          webEntryType: "module"
        },
        {
          dev: true,
          id: "@scope/extra",
          name: "@scope/extra",
          packageName: "@scope/extra",
          version: "0.0.0",
          webEntry: "http://127.0.0.1:5179/src/web.ts",
          webEntryType: "module"
        }
      ]
    });

    await expect(service.listPlugins()).resolves.toEqual([
      expect.objectContaining({
        dev: true,
        disabled: false,
        id: "@scope/demo",
        webEntry: "http://127.0.0.1:5178/src/web.ts",
        webEntryType: "module"
      }),
      expect.objectContaining({
        dev: true,
        disabled: false,
        id: "@scope/extra"
      })
    ]);
  });

  it("keeps disabled installed plugins from being overridden by development manifests", async () => {
    await createPluginPackage("@scope/demo", "1.0.0");
    await writeFile(
      join(pluginRoot, "plugins.json"),
      JSON.stringify({ "@scope/demo": { disabled: true } }),
      "utf8"
    );
    const service = createPluginsService({
      pluginRoot,
      runtimePluginManifests: () => [
        {
          dev: true,
          id: "@scope/demo",
          name: "@scope/demo",
          packageName: "@scope/demo",
          version: "0.0.0",
          webEntry: "http://127.0.0.1:5178/src/web.ts",
          webEntryType: "module"
        }
      ]
    });

    const plugins = await service.listPlugins();

    expect(plugins).toEqual([
      expect.objectContaining({
        disabled: true,
        id: "@scope/demo",
        webEntry: "/plugin-assets/%40scope__demo/web.js"
      })
    ]);
    expect(plugins[0]).not.toHaveProperty("dev");
  });

  it("omits webStyle for installed plugins when the exported style file is missing", async () => {
    await createPluginPackage("@scope/demo", "1.0.0", {
      style: "./dist/style.css"
    });
    const service = createPluginsService({ pluginRoot });

    await expect(service.listPlugins()).resolves.toEqual([
      expect.not.objectContaining({
        webStyle: expect.any(String)
      })
    ]);
  });

  it("persists disabled plugin state to the config file", async () => {
    await createPluginPackage("@scope/demo", "1.0.0");
    const service = createPluginsService({ pluginRoot });

    await service.setPluginDisabled("@scope/demo", true);

    await expect(readConfig()).resolves.toEqual({
      "@scope/demo": { disabled: true }
    });
    await expect(service.setPluginDisabled("missing", true)).resolves.toBeNull();

    await service.setPluginDisabled("@scope/demo", false);

    await expect(readConfig()).resolves.toEqual({
      "@scope/demo": { disabled: false }
    });
  });

  it("uninstalls a plugin package and removes stale disabled config", async () => {
    await createPluginPackage("@scope/demo", "1.0.0");
    await writeFile(
      join(pluginRoot, "plugins.json"),
      JSON.stringify({ "@scope/demo": { disabled: true } }),
      "utf8"
    );
    const service = createPluginsService({ pluginRoot });

    await expect(service.uninstallPlugin("@scope/demo")).resolves.toBe(true);

    await expect(service.listPlugins()).resolves.toEqual([]);
    await expect(readConfig()).resolves.toEqual({});
    await expect(service.uninstallPlugin("@scope/demo")).resolves.toBe(false);
  });

  it("installs a plugin package through the plugin-server installer", async () => {
    const installPluginPackage = vi.fn(async () => {
      await createPluginPackage("@scope/review", "2.0.0");
      return join(pluginRoot, "@scope__review");
    });
    const service = createPluginsService({ installPluginPackage, pluginRoot });

    const plugin = await service.installPlugin({
      source: "@scope/review",
      sourceType: "npm"
    });

    expect(installPluginPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginRoot,
        source: "@scope/review"
      })
    );
    expect(plugin).toEqual(
      expect.objectContaining({
        disabled: false,
        id: "@scope/review",
        packageName: "@scope/review",
        version: "2.0.0"
      })
    );
  });

  async function createPluginPackage(
    packageName: string,
    version: string,
    options: { readonly style?: string } = {}
  ) {
    const directory = join(pluginRoot, packageName.replaceAll("/", "__"));
    const webExport =
      options.style === undefined
        ? "./dist/web.js"
        : {
            import: "./dist/web.js",
            style: options.style
          };

    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        exports: {
          "./server": "./dist/server.js",
          "./web": webExport
        },
        name: packageName,
        version
      }),
      "utf8"
    );
  }

  async function readConfig() {
    return JSON.parse(
      await readFile(join(pluginRoot, "plugins.json"), "utf8")
    ) as unknown;
  }
});
