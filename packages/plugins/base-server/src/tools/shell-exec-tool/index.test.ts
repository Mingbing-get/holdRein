import { describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { createShellExecTool } from "./index";
import { classifyShellCommandRisk } from "./shell-command-risk";

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

  it("requests approval before executing remove shell commands", async () => {
    const tool = createShellExecTool(createEnv());
    const requestApproval = vi.fn().mockResolvedValue(undefined);

    await tool.beforeExecute?.({
      event: {
        input: { command: "rm date_file.txt" }
      },
      requestApproval,
      workspacePath: "/workspace"
    } as ServerPlugin.ToolBeforeExecuteOptions);

    expect(requestApproval).toHaveBeenCalledWith(
      "Allowed to execute the command: rm date_file.txt"
    );
  });

  it("classifies remove shell commands as dangerous", () => {
    expect(classifyShellCommandRisk("rm date_file.txt")).toBe("dangerous");
  });
});

function createEnv() {
  return {
    cwd: "/workspace"
  } as Parameters<typeof createShellExecTool>[0];
}
