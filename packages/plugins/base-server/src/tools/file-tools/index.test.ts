import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import {
  createDeleteFileTool,
  createEditFileTool,
  createFindFilesTool,
  createGrepFilesTool,
  createReadFileTool,
  createWriteFileTool
} from "./index";

describe("file tools", () => {
  it("reads a text file with optional line range", async () => {
    const cwd = await createWorkspace();
    await writeFile(join(cwd, "notes.txt"), "one\ntwo\nthree\n", "utf8");
    const tool = createReadFileTool(createEnv(cwd));

    const result = await tool.execute("call-1", {
      path: "notes.txt",
      offset: 2,
      limit: 1
    });

    expect(result.content).toEqual([{ type: "text", text: "two" }]);
    expect(result.details).toMatchObject({
      path: join(cwd, "notes.txt"),
      range: { offset: 2, limit: 1 }
    });
  });

  it("writes a file and creates parent directories", async () => {
    const cwd = await createWorkspace();
    const tool = createWriteFileTool(createEnv(cwd));

    const result = await tool.execute("call-1", {
      content: "export const value = 1;\n",
      path: "src/value.ts"
    });

    await expect(readFile(join(cwd, "src/value.ts"), "utf8")).resolves.toBe(
      "export const value = 1;\n"
    );
    expect(result.content[0]?.text).toContain("Successfully wrote");
  });

  it("requests approval before writing files", async () => {
    const tool = createWriteFileTool(createEnv("/workspace"));
    const requestApproval = vi.fn().mockResolvedValue(undefined);

    await tool.beforeExecute?.({
      event: { input: { path: "src/value.ts", content: "1" } },
      requestApproval,
      workspacePath: "/workspace"
    } as ServerPlugin.ToolBeforeExecuteOptions);

    expect(requestApproval).toHaveBeenCalledWith(
      "Allowed to write file: src/value.ts"
    );
  });

  it("deletes a file", async () => {
    const cwd = await createWorkspace();
    await writeFile(join(cwd, "remove-me.txt"), "temporary\n", "utf8");
    const tool = createDeleteFileTool(createEnv(cwd));

    const result = await tool.execute("call-1", {
      path: "remove-me.txt"
    });

    await expect(stat(join(cwd, "remove-me.txt"))).rejects.toThrow();
    expect(result.content[0]?.text).toContain(
      "Successfully deleted remove-me.txt"
    );
    expect(result.details).toMatchObject({
      path: join(cwd, "remove-me.txt")
    });
  });

  it("requests approval before deleting files", async () => {
    const tool = createDeleteFileTool(createEnv("/workspace"));
    const requestApproval = vi.fn().mockResolvedValue(undefined);

    await tool.beforeExecute?.({
      event: { input: { path: "src/value.ts" } },
      requestApproval,
      workspacePath: "/workspace"
    } as ServerPlugin.ToolBeforeExecuteOptions);

    expect(requestApproval).toHaveBeenCalledWith(
      "Allowed to delete file: src/value.ts"
    );
  });

  it("finds files containing text with grep", async () => {
    const cwd = await createWorkspace();
    await mkdir(join(cwd, "src"), { recursive: true });
    await writeFile(join(cwd, "src/a.ts"), "alpha\nneedle\n", "utf8");
    await writeFile(join(cwd, "src/b.ts"), "beta\n", "utf8");
    const tool = createGrepFilesTool(createEnv(cwd));

    const result = await tool.execute("call-1", {
      pattern: "needle",
      path: "src"
    });

    expect(result.content[0]?.text).toContain("a.ts:2:needle");
    expect(result.content[0]?.text).not.toContain("b.ts");
  });

  it("finds files by filename pattern", async () => {
    const cwd = await createWorkspace();
    await mkdir(join(cwd, "src/components"), { recursive: true });
    await writeFile(join(cwd, "src/components/button.tsx"), "", "utf8");
    await writeFile(join(cwd, "src/components/card.tsx"), "", "utf8");
    const tool = createFindFilesTool(createEnv(cwd));

    const result = await tool.execute("call-1", {
      pattern: "*button*",
      path: "src"
    });

    expect(result.content[0]?.text).toBe("components/button.tsx");
  });

  it("edits a unique text block and returns only changed details", async () => {
    const cwd = await createWorkspace();
    await writeFile(join(cwd, "example.ts"), "const name = 'old';\n", "utf8");
    const tool = createEditFileTool(createEnv(cwd));

    const result = await tool.execute("call-1", {
      path: "example.ts",
      oldText: "const name = 'old';",
      newText: "const name = 'new';"
    });

    await expect(readFile(join(cwd, "example.ts"), "utf8")).resolves.toBe(
      "const name = 'new';\n"
    );
    expect(result.content[0]?.text).toContain("Successfully replaced 1 block");
    expect(result.content[0]?.text).not.toContain("const name = 'new';\n");
    expect(result.details).toMatchObject({
      replacements: [
        {
          oldText: "const name = 'old';",
          newText: "const name = 'new';"
        }
      ]
    });
  });

  it("rejects edit text that is not unique", async () => {
    const cwd = await createWorkspace();
    await writeFile(join(cwd, "example.ts"), "same\nsame\n", "utf8");
    const tool = createEditFileTool(createEnv(cwd));

    await expect(
      tool.execute("call-1", {
        path: "example.ts",
        oldText: "same",
        newText: "changed"
      })
    ).rejects.toThrow("must be unique");
  });
});

async function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "hold-rein-file-tools-"));
}

function createEnv(cwd: string) {
  return {
    cwd
  } as Parameters<typeof createReadFileTool>[0];
}
