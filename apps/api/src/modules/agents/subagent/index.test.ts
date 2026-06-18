import { describe, expect, it, vi } from "vitest";

import { createCallSubagentTool, createRevokeSubagentTool } from ".";

describe("call subagent tool", () => {
  it("starts every requested subagent concurrently", async () => {
    const resolvers: (() => void)[] = [];
    const startSubagent = vi.fn(
      (input: { agentName: string; prompt: string; toolCallId: string }) =>
        new Promise<{
          content: { text: string; type: "text" }[];
          details: unknown;
        }>((resolve) => {
          resolvers.push(() =>
            resolve({
              content: [{ text: `${input.agentName} started`, type: "text" }],
              details: { agentName: input.agentName }
            })
          );
        })
    );
    const tool = createCallSubagentTool({ startSubagent });

    const result = tool.execute?.("tool-call-1", {
      subagents: [
        { agentName: "researcher", prompt: "Inspect auth" },
        { agentName: "reviewer", prompt: "Review auth" }
      ]
    });

    expect(startSubagent).toHaveBeenCalledTimes(2);
    expect(startSubagent).toHaveBeenNthCalledWith(1, {
      agentName: "researcher",
      prompt: "Inspect auth",
      toolCallId: "tool-call-1"
    });
    expect(startSubagent).toHaveBeenNthCalledWith(2, {
      agentName: "reviewer",
      prompt: "Review auth",
      toolCallId: "tool-call-1"
    });

    resolvers[1]?.();
    resolvers[0]?.();
    await expect(result).resolves.toEqual({
      content: [
        { text: "researcher started\nreviewer started", type: "text" }
      ],
      details: {
        subagents: [{ agentName: "researcher" }, { agentName: "reviewer" }]
      }
    });
  });
});

describe("revoke subagent tool", () => {
  it("continues an existing subagent with the required prompt", async () => {
    const continueSubagent = vi.fn().mockResolvedValue({
      content: [{ text: "Subagent resumed", type: "text" }],
      details: { agentId: "agent_child" }
    });
    const tool = createRevokeSubagentTool({ continueSubagent });

    await expect(
      tool.execute?.("tool-call-1", {
        agentId: " agent_child ",
        prompt: " Check the follow-up "
      })
    ).resolves.toEqual({
      content: [{ text: "Subagent resumed", type: "text" }],
      details: { agentId: "agent_child" }
    });

    expect(continueSubagent).toHaveBeenCalledWith({
      agentId: "agent_child",
      prompt: "Check the follow-up",
      toolCallId: "tool-call-1"
    });
  });

  it("requires an existing subagent id and prompt", async () => {
    const tool = createRevokeSubagentTool({
      continueSubagent: vi.fn()
    });

    await expect(tool.execute?.("tool-call-1", { agentId: "", prompt: "" }))
      .rejects.toThrow("revoke_subagent requires an agentId");
    await expect(tool.execute?.("tool-call-1", {
      agentId: "agent_child",
      prompt: ""
    })).rejects.toThrow("revoke_subagent requires a prompt");
  });
});
