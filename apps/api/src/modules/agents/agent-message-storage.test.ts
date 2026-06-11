import { describe, expect, it } from "vitest";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

import {
  toStoredAgentMessage
} from "./agent-message-storage";

describe("agent message storage", () => {
  it("removes response metadata while preserving assistant context", () => {
    const stored = toStoredAgentMessage("message-1", {
      api: "openai-responses",
      content: [
        { text: "Answer", type: "text" },
        { thinking: "Reason", thinkingSignature: "sig", type: "thinking" }
      ],
      diagnostics: [{ message: "warning", type: "warning" }],
      model: "gpt-4.1",
      provider: "openai",
      responseId: "resp-1",
      responseModel: "gpt-4.1-snapshot",
      role: "assistant",
      stopReason: "stop",
      timestamp: 1,
      usage: {
        cacheRead: 3,
        cacheWrite: 4,
        cost: { cacheRead: 1, cacheWrite: 1, input: 1, output: 1, total: 4 },
        input: 1,
        output: 2,
        totalTokens: 10
      }
    } as unknown as AgentMessage);

    expect(stored).toEqual({
      api: "openai-responses",
      content: [
        { text: "Answer", type: "text" },
        { thinking: "Reason", thinkingSignature: "sig", type: "thinking" }
      ],
      id: "message-1",
      model: "gpt-4.1",
      provider: "openai",
      role: "assistant",
      stopReason: "stop",
      timestamp: 1
    });
  });
});
