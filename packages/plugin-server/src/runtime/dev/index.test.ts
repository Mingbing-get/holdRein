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
      scripts: {
        dev: "vite --config vite.web.config.ts"
      },
      version: "0.0.0"
    })
  );

  return root;
}

describe("startDevPluginManager", () => {
  it("starts each plugin dev command with corepack pnpm dev", async () => {
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const spawn = vi.fn(() => child);

    await startDevPluginManager({
      pluginPaths: [pluginPath],
      spawn,
      watch: () => ({ close: vi.fn() })
    });

    expect(spawn).toHaveBeenCalledWith("corepack", ["pnpm", "dev"], {
      cwd: pluginPath
    });
  });

  it("resolves development manifests from package exports and Vite stdout", async () => {
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };

    const manager = await startDevPluginManager({
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
    expect(manager.getServerPluginEntries()).toEqual([
      {
        entryPath: join(pluginPath, "src/server.ts"),
        manifest: manager.getWebPluginManifests()[0],
        packageDirectory: pluginPath
      }
    ]);
  });

  it("debounces server reload callbacks after watched file changes", async () => {
    vi.useFakeTimers();
    const pluginPath = await createDevPluginPackage();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };
    const onReload = vi.fn();
    const watchers: Array<() => void> = [];

    await startDevPluginManager({
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
    expect(onReload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("closes child processes and watchers", async () => {
    const pluginPath = await createDevPluginPackage();
    const close = vi.fn();
    const child: FakeChildProcess = { kill: vi.fn(), stdout: new EventEmitter() };

    const manager = await startDevPluginManager({
      pluginPaths: [pluginPath],
      spawn: () => child,
      watch: () => ({ close })
    });

    await manager.close();

    expect(child.kill).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
