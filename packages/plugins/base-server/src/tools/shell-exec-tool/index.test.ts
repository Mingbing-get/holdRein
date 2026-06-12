import { describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { createShellExecTool } from "./index";

describe("createShellExecTool", () => {
  it("creates the shell exec tool", () => {
    const tool = createShellExecTool(createEnv());

    expect(tool.name).toBe("shell_exec");
  });

  it("requests approval before executing write shell commands", async () => {
    const tool = createShellExecTool(createEnv());
    const requestApproval = vi.fn().mockResolvedValue(undefined);

    await tool.beforeExecute?.({
      event: {
        input: { command: "touch output.txt" }
      },
      requestApproval,
      workspacePath: "/workspace"
    } as ServerPlugin.ToolBeforeExecuteOptions);

    expect(requestApproval).toHaveBeenCalledWith(
      "Allowed to execute the command: touch output.txt"
    );
  });
});

function createEnv() {
  return {
    cwd: "/workspace"
  } as Parameters<typeof createShellExecTool>[0];
}
