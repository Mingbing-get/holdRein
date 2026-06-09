import { describe, expect, it } from "vitest";

import { toCustomAgentModel } from "./custom-agent-model";

describe("custom agent model", () => {
  it("uses the system role for OpenAI-compatible custom models", () => {
    expect(
      toCustomAgentModel({
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        model: {
          api: "openai-completions",
          contextWindow: 128000,
          id: "deepseek-v3-2-251201",
          input: ["text"],
          maxTokens: 8192,
          name: "DeepSeek V3.2",
          provider: "volcengine-ark",
          reasoning: true
        }
      })
    ).toEqual(
      expect.objectContaining({
        compat: {
          supportsDeveloperRole: false
        }
      })
    );
  });
});
