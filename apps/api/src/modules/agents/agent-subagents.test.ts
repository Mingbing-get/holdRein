import { describe, expect, it, vi } from "vitest";

import { createCallSubagentTool } from "./agent-subagents";

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
