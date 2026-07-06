import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  fixRuntimeApiImports,
  syncRuntimeApiDependencies
} from "./copy-runtime.mjs";

describe("copy runtime import rewriting", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        import("node:fs/promises").then(({ rm }) =>
          rm(directory, { force: true, recursive: true })
        )
      )
    );
    temporaryDirectories.length = 0;
  });

  it("rewrites current-directory imports to index files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runtime-imports-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "default.js");

    await writeFile(
      join(directory, "index.js"),
      "export const value = 1;\n"
    );
    await writeFile(entryPath, 'import { value } from ".";\n');

    await fixRuntimeApiImports(directory);

    await expect(readFile(entryPath, "utf8")).resolves.toBe(
      'import { value } from "./index.js";\n'
    );
  });

  it("declares copied API runtime package dependencies in the CLI manifest", async () => {
    const apiPackageJson = await readPackageJson(resolve("apps/api/package.json"));
    const cliPackageJson = await readPackageJson(resolve("apps/cli/package.json"));
    const apiRuntimeDependencies = Object.entries(apiPackageJson.dependencies)
      .filter(([, version]) => !version.startsWith("workspace:"))
      .map(([name]) => name);

    expect(Object.keys(cliPackageJson.dependencies)).toEqual(
      expect.arrayContaining(apiRuntimeDependencies)
    );
  });

  it("adds missing API runtime package dependencies to the CLI manifest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runtime-dependencies-"));
    temporaryDirectories.push(directory);
    const apiPackageJsonPath = join(directory, "api", "package.json");
    const cliPackageJsonPath = join(directory, "cli", "package.json");

    await mkdir(join(directory, "api"), { recursive: true });
    await mkdir(join(directory, "cli"), { recursive: true });
    await writeFile(
      apiPackageJsonPath,
      JSON.stringify(
        {
          dependencies: {
            "@hold-rein/plugin-server": "workspace:^",
            "cron-parser": "latest",
            express: "5.2.1",
            "node-cron": "latest"
          }
        },
        null,
        2
      )
    );
    await writeFile(
      cliPackageJsonPath,
      `${JSON.stringify(
        {
          dependencies: {
            express: "5.2.1"
          }
        },
        null,
        2
      )}\n`
    );

    await syncRuntimeApiDependencies({
      apiPackageJsonPath,
      cliPackageJsonPath
    });

    await expect(readPackageJson(cliPackageJsonPath)).resolves.toEqual({
      dependencies: {
        express: "5.2.1",
        "cron-parser": "latest",
        "node-cron": "latest"
      }
    });
  });
});

async function readPackageJson(
  path: string
): Promise<{ dependencies: Record<string, string> }> {
  return JSON.parse(await readFile(path, "utf8")) as {
    dependencies: Record<string, string>;
  };
}
