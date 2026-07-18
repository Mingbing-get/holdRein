import { lstat, mkdir, mkdtemp, readlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

import { linkServerPluginNodeModules } from "./symlinks";

it("links the plugin node_modules directory to the host node_modules", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-link-"));
  const hostNodeModules = join(root, "host", "node_modules");
  const pluginRoot = join(root, "plugins");

  await linkServerPluginNodeModules({
    hostNodeModules,
    pluginRoot
  });

  expect((await lstat(join(pluginRoot, "node_modules"))).isSymbolicLink()).toBe(
    true
  );
  expect(await readlink(join(pluginRoot, "node_modules"))).toBe(hostNodeModules);
});

it("replaces an existing plugin node_modules directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-link-"));
  const hostNodeModules = join(root, "host", "node_modules");
  const pluginRoot = join(root, "plugins");

  await mkdir(join(pluginRoot, "node_modules", "stale"), { recursive: true });

  await linkServerPluginNodeModules({
    hostNodeModules,
    pluginRoot
  });

  expect(await readlink(join(pluginRoot, "node_modules"))).toBe(hostNodeModules);
});
