import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "./index";

const collectOutput = (): {
  readonly lines: string[];
  readonly write: (value: string) => void;
} => {
  const lines: string[] = [];

  return {
    lines,
    write: (value: string): void => {
      lines.push(value);
    }
  };
};

describe("runCli", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true })
      )
    );
    temporaryDirectories.length = 0;
  });

  it("prints the package version for the version command", async () => {
    const output = collectOutput();

    const result = await runCli(["version"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual(["1.2.3\n"]);
  });

  it("prints the package version for the version flag", async () => {
    const output = collectOutput();

    const result = await runCli(["--version"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual(["1.2.3\n"]);
  });

  it("prints help for the help command", async () => {
    const output = collectOutput();

    const result = await runCli(["help"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines.join("")).toContain("Usage: hold-rein <command>");
    expect(output.lines.join("")).toContain("Aliases: hold-rein, hr");
    expect(output.lines.join("")).toContain("start");
    expect(output.lines.join("")).toContain("version");
    expect(output.lines.join("")).toContain("help");
  });

  it("starts the bundled service for the start command", async () => {
    const output = collectOutput();
    const calls: unknown[] = [];

    const result = await runCli(["start", "--port", "4100"], {
      packageVersion: "1.2.3",
      startRunServer: async (options) => {
        calls.push(options);
        return {
          host: "127.0.0.1",
          port: options.port,
          url: `http://127.0.0.1:${options.port}`
        };
      },
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      {
        host: "127.0.0.1",
        port: 4100,
        write: output.write
      }
    ]);
    expect(output.lines).toEqual([
      "Hold Rein is running at http://127.0.0.1:4100\n"
    ]);
  });

  it("prints help for the help flag", async () => {
    const output = collectOutput();

    const result = await runCli(["--help"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines.join("")).toContain("Usage: hold-rein <command>");
  });

  it("initializes a plugin package in the current directory", async () => {
    const output = collectOutput();
    const directory = await mkdtemp(join(tmpdir(), "sample-plugin-"));
    temporaryDirectories.push(directory);

    const result = await runCli(["plugin", "init"], {
      currentWorkingDirectory: directory,
      packageVersion: "1.2.3",
      write: output.write
    });

    const folderName = basename(directory);
    const packageJson = JSON.parse(
      await readFile(join(directory, "package.json"), "utf8")
    ) as { readonly name: string };

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual([
      `Initialized plugin package hold-rein-plugin-${folderName}\n`
    ]);
    expect(packageJson.name).toBe(`hold-rein-plugin-${folderName}`);
    await expect(readFile(join(directory, "tsconfig.json"), "utf8")).resolves.toContain(
      '"rootDir": "src"'
    );
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

  it("initializes a named plugin package in a child directory", async () => {
    const output = collectOutput();
    const directory = await mkdtemp(join(tmpdir(), "plugins-root-"));
    temporaryDirectories.push(directory);

    const result = await runCli(["plugin", "init", "--name", "named-plugin"], {
      currentWorkingDirectory: directory,
      packageVersion: "1.2.3",
      write: output.write
    });

    const pluginDirectory = join(directory, "named-plugin");
    const packageJson = JSON.parse(
      await readFile(join(pluginDirectory, "package.json"), "utf8")
    ) as { readonly name: string };

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual([
      "Initialized plugin package hold-rein-plugin-named-plugin\n"
    ]);
    expect(packageJson.name).toBe("hold-rein-plugin-named-plugin");
    await expect(
      readFile(join(pluginDirectory, "src", "plugin-id.ts"), "utf8")
    ).resolves.toBe('export const PLUGIN_ID = "__named-plugin__plugin";\n');
  });

  it("initializes a plugin package in a provided path", async () => {
    const output = collectOutput();
    const directory = await mkdtemp(join(tmpdir(), "workspace-"));
    temporaryDirectories.push(directory);

    const pluginDirectory = join(directory, "custom-plugin");

    const result = await runCli(["plugin", "init", "--path", pluginDirectory], {
      currentWorkingDirectory: directory,
      packageVersion: "1.2.3",
      write: output.write
    });

    const packageJson = JSON.parse(
      await readFile(join(pluginDirectory, "package.json"), "utf8")
    ) as { readonly name: string };

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual([
      "Initialized plugin package hold-rein-plugin-custom-plugin\n"
    ]);
    expect(packageJson.name).toBe("hold-rein-plugin-custom-plugin");
    await expect(
      readFile(join(pluginDirectory, "src", "plugin-id.ts"), "utf8")
    ).resolves.toBe('export const PLUGIN_ID = "__custom-plugin__plugin";\n');
  });

  it("initializes a named plugin package inside a provided path", async () => {
    const output = collectOutput();
    const directory = await mkdtemp(join(tmpdir(), "plugins-root-"));
    temporaryDirectories.push(directory);

    const result = await runCli(
      ["plugin", "init", "--path", directory, "--name", "nested-plugin"],
      {
        currentWorkingDirectory: tmpdir(),
        packageVersion: "1.2.3",
        write: output.write
      }
    );

    const pluginDirectory = join(directory, "nested-plugin");
    const packageJson = JSON.parse(
      await readFile(join(pluginDirectory, "package.json"), "utf8")
    ) as { readonly name: string };

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual([
      "Initialized plugin package hold-rein-plugin-nested-plugin\n"
    ]);
    expect(packageJson.name).toBe("hold-rein-plugin-nested-plugin");
    await expect(
      readFile(join(pluginDirectory, "src", "plugin-id.ts"), "utf8")
    ).resolves.toBe('export const PLUGIN_ID = "__nested-plugin__plugin";\n');
  });

  it("fails when the path option is missing a value", async () => {
    const output = collectOutput();

    const result = await runCli(["plugin", "init", "--path"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(1);
    expect(output.lines).toEqual([
      "Failed to initialize plugin package: Missing value for --path\n"
    ]);
  });

  it("installs a plugin into a custom target directory", async () => {
    const output = collectOutput();
    const installCalls: unknown[] = [];

    const result = await runCli(
      ["plugin", "install", "@scope/demo", "--target", "/tmp/plugins"],
      {
        installPluginPackage: async (options) => {
          installCalls.push(options);
          options.write("Running: npm install @scope/demo --ignore-scripts\n");
          return "/tmp/plugins/@scope__demo";
        },
        packageVersion: "1.2.3",
        write: output.write
      }
    );

    expect(result.exitCode).toBe(0);
    expect(installCalls).toEqual([
      {
        currentWorkingDirectory: process.cwd(),
        pluginRoot: "/tmp/plugins",
        source: "@scope/demo",
        write: output.write
      }
    ]);
    expect(output.lines).toEqual([
      "Running: npm install @scope/demo --ignore-scripts\n",
      "Installed plugin to /tmp/plugins/@scope__demo\n"
    ]);
  });

  it("installs a plugin into the default home plugin directory", async () => {
    const output = collectOutput();
    const installCalls: unknown[] = [];

    const result = await runCli(["plugin", "install", "plain-demo"], {
      installPluginPackage: async (options) => {
        installCalls.push(options);
        return join(homedir(), ".hold-rein", "plugins", "plain-demo");
      },
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(installCalls).toEqual([
      {
        currentWorkingDirectory: process.cwd(),
        pluginRoot: join(homedir(), ".hold-rein", "plugins"),
        source: "plain-demo",
        write: output.write
      }
    ]);
  });

  it("fails when the plugin install source is missing", async () => {
    const output = collectOutput();

    const result = await runCli(["plugin", "install"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(1);
    expect(output.lines).toEqual([
      "Failed to install plugin: Missing plugin source\n"
    ]);
  });

  it("fails when the target option is missing a value", async () => {
    const output = collectOutput();

    const result = await runCli(["plugin", "install", "plain-demo", "--target"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(1);
    expect(output.lines).toEqual([
      "Failed to install plugin: Missing value for --target\n"
    ]);
  });
});
