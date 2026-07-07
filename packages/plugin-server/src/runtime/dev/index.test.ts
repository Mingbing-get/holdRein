import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { startDevPluginManager } from ".";

interface FakeChildProcess {
  readonly kill: ReturnType<typeof vi.fn>;
  readonly stdout: EventEmitter;
}

async function createDevPluginPackage(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-dev-plugin-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      exports: {
        "./server": {
          import: "./src/server.ts"
        },
        "./web": {
          import: "./src/web.ts"
        }
      },
      name: "@scope/demo",
      publishConfig: {
        exports: {
          "./server": {
            import: "./dist/server.js"
          }
        }
      },
      scripts: {
        dev: "vite --config vite.web.config.ts"
      },
      version: "0.0.0"
    })
  );
  await writeFile(
    join(root, "src", "plugin-id.ts"),
    'export const PLUGIN_ID = "__demo__plugin";\n'
  );
  await writeFile(
    join(root, "src", "server.ts"),
    'import { PLUGIN_ID } from "./plugin-id";\n\nexport default { id: PLUGIN_ID };\n'
  );
  await writeFile(join(root, "src", "web.ts"), "export default {};\n");

  return root;
}

describe("startDevPluginManager", () => {
  it("starts each plugin dev command with corepack pnpm dev", async () => {
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const spawn = vi.fn(() => child);
    const buildServerBundle = vi.fn();
    const watch = vi.fn(() => ({ close: vi.fn() }));

    await startDevPluginManager({
      buildServerBundle,
      pluginPaths: [pluginPath],
      spawn,
      watch
    });

    expect(spawn).toHaveBeenCalledWith("corepack", ["pnpm", "dev"], {
      cwd: pluginPath
    });
    expect(watch).toHaveBeenCalledWith(join(pluginPath, "src"), expect.any(Function));
  });

  it("resolves development manifests from package exports and Vite stdout", async () => {
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const buildServerBundle = vi.fn();

    const manager = await startDevPluginManager({
      buildServerBundle,
      pluginPaths: [pluginPath],
      spawn: () => child,
      watch: () => ({ close: vi.fn() })
    });

    child.stdout.emit("data", "  Local:   http://127.0.0.1:5178/\n");

    expect(manager.getWebPluginManifests()).toEqual([
      {
        dev: true,
        id: "@scope/demo",
        name: "@scope/demo",
        packageName: "@scope/demo",
        version: "0.0.0",
        webEntry: "http://127.0.0.1:5178/src/web.ts",
        webEntryType: "module"
      }
    ]);
    expect(manager.getServerPluginEntries()[0]).toMatchObject({
      manifest: manager.getWebPluginManifests()[0],
      packageDirectory: pluginPath
    });
    expect(manager.getServerPluginEntries()[0]?.entryPath).toBe(
      join(pluginPath, "dist/server.js")
    );
  });

  it("reloads runtime plugin manifests when the frontend dev URL becomes available", async () => {
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const buildServerBundle = vi.fn();
    const onReload = vi.fn();

    await startDevPluginManager({
      buildServerBundle,
      onReload,
      pluginPaths: [pluginPath],
      spawn: () => child,
      watch: () => ({ close: vi.fn() })
    });

    child.stdout.emit("data", "  Local:   http://127.0.0.1:5178/\n");

    expect(onReload).toHaveBeenCalledOnce();
    expect(buildServerBundle).toHaveBeenCalledOnce();
  });

  it("builds the server bundle before exposing development server entries", async () => {
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const buildServerBundle = vi.fn();

    const manager = await startDevPluginManager({
      buildServerBundle,
      pluginPaths: [pluginPath],
      spawn: () => child,
      watch: () => ({ close: vi.fn() })
    });

    expect(buildServerBundle).toHaveBeenCalledWith(pluginPath);
    expect(manager.getServerPluginEntries()[0]?.entryPath).toBe(
      join(pluginPath, "dist/server.js")
    );
  });

  it("rebuilds the server bundle before reloading after watched file changes", async () => {
    vi.useFakeTimers();
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const onReload = vi.fn();
    const buildServerBundle = vi.fn();
    const watchers: (() => void)[] = [];

    await startDevPluginManager({
      buildServerBundle,
      debounceMs: 50,
      onReload,
      pluginPaths: [pluginPath],
      spawn: () => child,
      watch: (_path, callback) => {
        watchers.push(callback);
        return { close: vi.fn() };
      }
    });

    watchers[0]?.();
    watchers[0]?.();
    await vi.advanceTimersByTimeAsync(49);
    expect(onReload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(buildServerBundle).toHaveBeenCalledTimes(2);
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(buildServerBundle.mock.invocationCallOrder[1]).toBeLessThan(
      onReload.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
    vi.useRealTimers();
  });

  it("closes child processes and watchers", async () => {
    const pluginPath = await createDevPluginPackage();
    const close = vi.fn();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const buildServerBundle = vi.fn();

    const manager = await startDevPluginManager({
      buildServerBundle,
      pluginPaths: [pluginPath],
      spawn: () => child,
      watch: () => ({ close })
    });

    await manager.close();

    expect(child.kill).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
