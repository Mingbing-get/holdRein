import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

import {
  copyInstalledPluginPackage,
  encodePluginDirectoryName
} from "./plugin-installer";

it("encodes package names into stable plugin directory names", () => {
  expect(encodePluginDirectoryName("@scope/demo")).toBe("@scope__demo");
  expect(encodePluginDirectoryName("plain-demo")).toBe("plain-demo");
});

it("copies a resolved package directory into the plugin root", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-install-"));
  const source = join(root, "tmp", "node_modules", "@scope", "demo");

  await mkdir(join(source, "dist"), { recursive: true });
  await writeFile(join(source, "package.json"), "{}");

  const destination = await copyInstalledPluginPackage({
    packageName: "@scope/demo",
    pluginRoot: join(root, "plugins"),
    sourcePackageDir: source
  });

  expect(destination).toBe(join(root, "plugins", "@scope__demo"));
  await expect(
    readFile(join(destination, "package.json"), "utf8")
  ).resolves.toBe("{}");
});
