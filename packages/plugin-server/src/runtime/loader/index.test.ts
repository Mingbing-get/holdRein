import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

import { loadInstalledServerPlugins } from ".";

it("imports plugin default exports and returns web manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-load-"));
  const dir = join(root, "@scope__demo");

  await mkdir(join(dir, "dist", "server"), { recursive: true });
  await writeFile(
    join(dir, "dist", "server", "index.js"),
    'export default { id: "demo" };'
  );
  await writeFile(join(dir, "dist", "style.css"), ":root {}");
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: "@scope/demo",
      version: "1.0.0",
      exports: {
        ".": "./dist/server/index.js",
        "./web": {
          import: "./dist/web/index.js",
          style: "./dist/style.css"
        }
      }
    })
  );

  const result = await loadInstalledServerPlugins({
    hostNodeModules: join(root, "host", "node_modules"),
    pluginRoot: root,
    toImportUrl: (path) => pathToFileURL(path).href
  });

  expect(result.plugins).toEqual([{ id: "demo" }]);
  expect(result.webPlugins[0]).toEqual({
    id: "@scope/demo",
    name: "@scope/demo",
    packageName: "@scope/demo",
    version: "1.0.0",
    webEntry: "/plugin-assets/%40scope__demo/web/index.js",
    webStyle: "/plugin-assets/%40scope__demo/style.css"
  });
});

it("skips disabled plugin manifests before importing server entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-load-"));
  const dir = join(root, "@scope__demo");

  await mkdir(join(dir, "dist", "server"), { recursive: true });
  await writeFile(
    join(dir, "dist", "server", "index.js"),
    'throw new Error("disabled plugin should not import");'
  );
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      exports: {
        "./server": "./dist/server/index.js",
        "./web": "./dist/web/index.js"
      },
      name: "@scope/demo",
      version: "1.0.0"
    })
  );

  const result = await loadInstalledServerPlugins({
    disabledPluginIds: ["@scope/demo"],
    hostNodeModules: join(root, "host", "node_modules"),
    pluginRoot: root,
    toImportUrl: (path) => pathToFileURL(path).href
  });

  expect(result.plugins).toEqual([]);
  expect(result.webPlugins).toEqual([]);
});
