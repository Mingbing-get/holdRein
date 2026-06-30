import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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

  it("prints the package version for the version command", () => {
    const output = collectOutput();

    const result = runCli(["version"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual(["1.2.3\n"]);
  });

  it("prints the package version for the version flag", () => {
    const output = collectOutput();

    const result = runCli(["--version"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines).toEqual(["1.2.3\n"]);
  });

  it("prints help for the help command", () => {
    const output = collectOutput();

    const result = runCli(["help"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(output.lines.join("")).toContain("Usage: hold-rein <command>");
    expect(output.lines.join("")).toContain("Aliases: hold-rein, hr");
    expect(output.lines.join("")).toContain("version");
    expect(output.lines.join("")).toContain("help");
  });

  it("prints help for the help flag", () => {
    const output = collectOutput();

    const result = runCli(["--help"], {
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

  it("fails when the path option is missing a value", () => {
    const output = collectOutput();

    const result = runCli(["plugin", "init", "--path"], {
      packageVersion: "1.2.3",
      write: output.write
    });

    expect(result.exitCode).toBe(1);
    expect(output.lines).toEqual([
      "Failed to initialize plugin package: Missing value for --path\n"
    ]);
  });
});
