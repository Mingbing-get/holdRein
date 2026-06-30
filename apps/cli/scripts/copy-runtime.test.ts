import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { fixRuntimeApiImports } from "./copy-runtime.mjs";

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
});
