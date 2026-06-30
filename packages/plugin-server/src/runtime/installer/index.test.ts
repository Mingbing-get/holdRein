import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  copyInstalledPluginPackage,
  encodePluginDirectoryName,
  installPluginPackage
} from ".";

describe("plugin installer", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true })
      )
    );
    temporaryDirectories.length = 0;
  });

  it("encodes package names into stable plugin directory names", () => {
    expect(encodePluginDirectoryName("@scope/demo")).toBe("@scope__demo");
    expect(encodePluginDirectoryName("plain-demo")).toBe("plain-demo");
  });

  it("copies a resolved package directory into the plugin root", async () => {
    const root = await createTemporaryDirectory();
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

  it("installs an npm package from a temporary node_modules directory", async () => {
    const root = await createTemporaryDirectory();
    const commandRunner = vi.fn(async (command: string, args: readonly string[], cwd) => {
      expect(command).toBe("npm");
      expect(args).toEqual(["install", "@scope/demo", "--ignore-scripts"]);
      const packageDir = join(cwd, "node_modules", "@scope", "demo");
      await mkdir(packageDir, { recursive: true });
      await writePluginPackageJson(packageDir, "@scope/demo");
    });

    const destination = await installPluginPackage({
      pluginRoot: join(root, "plugins"),
      runCommand: commandRunner,
      source: "@scope/demo",
      tempRoot: join(root, "temp")
    });

    expect(destination).toBe(join(root, "plugins", "@scope__demo"));
    expect(commandRunner).toHaveBeenCalledOnce();
    await expect(
      readFile(join(destination, "package.json"), "utf8")
    ).resolves.toContain('"./server"');
  });

  it("rejects packages that do not export a server entry", async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, "invalid-plugin");

    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({ name: "invalid-plugin", version: "1.0.0", exports: {} })
    );

    await expect(
      installPluginPackage({
        pluginRoot: join(root, "plugins"),
        source
      })
    ).rejects.toThrow('Plugin package "exports" must define "./server".');
  });

  it("builds a local source plugin with pnpm before installing dist", async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, "source-plugin");
    const output: string[] = [];
    const commandRunner = vi.fn(async (command: string, args: readonly string[]) => {
      if (command === "pnpm" && args[0] === "build") {
        await mkdir(join(source, "dist"), { recursive: true });
        await writePluginPackageJson(join(source, "dist"), "source-plugin");

        return {
          stderr: "build warning",
          stdout: "build ok"
        };
      }

      return { stdout: `${command} ${args.join(" ")} ok` };
    });

    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "source-plugin",
        version: "1.0.0",
        exports: {
          "./server": {
            import: "./src/server.ts"
          }
        },
        scripts: {
          build: "vite build"
        }
      })
    );

    const destination = await installPluginPackage({
      pluginRoot: join(root, "plugins"),
      runCommand: commandRunner,
      source,
      write: (value) => {
        output.push(value);
      }
    });

    expect(commandRunner).toHaveBeenNthCalledWith(1, "pnpm", ["--version"], source);
    expect(commandRunner).toHaveBeenNthCalledWith(2, "pnpm", ["install"], source);
    expect(commandRunner).toHaveBeenNthCalledWith(3, "pnpm", ["build"], source);
    expect(destination).toBe(join(root, "plugins", "source-plugin"));
    expect(output.join("")).toContain("Running: pnpm install\n");
    expect(output.join("")).toContain("pnpm install ok\n");
    expect(output.join("")).toContain("Running: pnpm build\n");
    expect(output.join("")).toContain("build ok\n");
    expect(output.join("")).toContain("build warning\n");
    expect(output.join("")).toContain(
      `Copying plugin files: ${join(source, "dist")} -> ${destination}\n`
    );
  });

  it("uses publishConfig to override source package fields for built plugins", async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, "source-plugin");
    const commandRunner = vi.fn(async (command: string, args: readonly string[]) => {
      if (command === "pnpm" && args[0] === "build") {
        await mkdir(join(source, "dist"), { recursive: true });
      }
    });

    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "source-plugin",
        version: "1.0.0",
        exports: {
          "./server": {
            import: "./src/server.ts"
          }
        },
        peerDependencies: {
          react: "^19.0.0"
        },
        publishConfig: {
          exports: {
            "./server": {
              import: "./dist/server.js"
            }
          }
        }
      })
    );

    const destination = await installPluginPackage({
      pluginRoot: join(root, "plugins"),
      runCommand: commandRunner,
      source
    });

    await expect(readFile(join(destination, "package.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(
        {
          name: "source-plugin",
          version: "1.0.0",
          exports: {
            "./server": {
              import: "./dist/server.js"
            }
          },
          peerDependencies: {
            react: "^19.0.0"
          }
        },
        null,
        2
      )}\n`
    );
  });

  it("tries to install pnpm before failing when pnpm is missing", async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, "source-plugin");
    const commandRunner = vi.fn(async (command: string, args: readonly string[]) => {
      if (command === "pnpm") {
        throw new Error("pnpm missing");
      }
      if (command === "npm" && args[0] === "install") {
        throw new Error("cannot install pnpm");
      }
    });

    await mkdir(source, { recursive: true });
    await writePluginPackageJson(source, "source-plugin", "./src/server.ts");

    await expect(
      installPluginPackage({
        pluginRoot: join(root, "plugins"),
        runCommand: commandRunner,
        source
      })
    ).rejects.toThrow("pnpm is required to build plugin sources");
    expect(commandRunner).toHaveBeenNthCalledWith(1, "pnpm", ["--version"], source);
    expect(commandRunner).toHaveBeenNthCalledWith(
      2,
      "npm",
      ["install", "--global", "pnpm"],
      source
    );
  });

  it("clones and builds a GitHub source plugin", async () => {
    const root = await createTemporaryDirectory();
    const commandRunner = vi.fn(async (command: string, args: readonly string[], cwd) => {
      if (command === "pnpm" && args[0] === "build") {
        await mkdir(join(cwd, "dist"), { recursive: true });
        await writePluginPackageJson(join(cwd, "dist"), "github-plugin");
      }
    });
    const installGitRepository = vi.fn(async (_url: string, targetDir: string) => {
      await mkdir(targetDir, { recursive: true });
      await writePluginPackageJson(targetDir, "github-plugin", "./src/server.ts");
    });

    const destination = await installPluginPackage({
      installGitRepository,
      pluginRoot: join(root, "plugins"),
      runCommand: commandRunner,
      source: "https://github.com/acme/github-plugin"
    });

    expect(installGitRepository).toHaveBeenCalledWith(
      "https://github.com/acme/github-plugin.git",
      expect.any(String)
    );
    expect(destination).toBe(join(root, "plugins", "github-plugin"));
  });

  it("clones and builds a plugin from a GitHub tree URL", async () => {
    const root = await createTemporaryDirectory();
    const commandRunner = vi.fn(async (command: string, args: readonly string[], cwd) => {
      if (command === "pnpm" && args[0] === "build") {
        await mkdir(join(cwd, "dist"), { recursive: true });
        await writePluginPackageJson(join(cwd, "dist"), "nested-plugin");
      }
    });
    const installGitRepository = vi.fn(async (_url: string, targetDir: string) => {
      const pluginDir = join(targetDir, "packages", "nested-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writePluginPackageJson(pluginDir, "nested-plugin", "./src/server.ts");
    });

    const destination = await installPluginPackage({
      installGitRepository,
      pluginRoot: join(root, "plugins"),
      runCommand: commandRunner,
      source: "https://github.com/acme/plugins/tree/main/packages/nested-plugin"
    });

    expect(installGitRepository).toHaveBeenCalledWith(
      "https://github.com/acme/plugins.git",
      expect.any(String),
      "main"
    );
    expect(destination).toBe(join(root, "plugins", "nested-plugin"));
  });

  async function createTemporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "hold-rein-install-"));
    temporaryDirectories.push(directory);
    return directory;
  }
});

async function writePluginPackageJson(
  directory: string,
  name: string,
  serverEntry = "./dist/server.js"
): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      exports: {
        "./server": {
          import: serverEntry
        }
      }
    })
  );
}
