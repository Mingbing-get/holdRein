import { lstat, mkdtemp, readlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

import { linkServerPluginSharedPackages } from "./shared-symlinks";

it("creates shared package symlinks in plugin node_modules", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-link-"));

  await linkServerPluginSharedPackages({
    hostNodeModules: join(root, "host", "node_modules"),
    packages: ["@scope/shared", "express"],
    pluginRoot: join(root, "plugins")
  });

  expect(
    (await lstat(join(root, "plugins", "node_modules", "@scope", "shared")))
      .isSymbolicLink()
  ).toBe(true);
  expect(await readlink(join(root, "plugins", "node_modules", "express"))).toBe(
    join(root, "host", "node_modules", "express")
  );
});
