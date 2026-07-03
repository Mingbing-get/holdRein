import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it } from "vitest";

import serverPlugin from "./server";

describe("ts-standards server plugin", () => {
  it("does not contribute to the memory organizer agent", async () => {
    const resolver = serverPlugin.contributionResolver;
    expect(typeof resolver).toBe("function");

    if (typeof resolver !== "function") {
      throw new TypeError("Expected a contribution resolver function");
    }

    const contribution = await resolver(createRuntimeContext());

    expect(contribution).toEqual({});
  });
});

function createRuntimeContext(): ServerPlugin.RuntimeContext {
  return {
    agentName: "memory-organizer",
    env: { cwd: "/workspace" } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "Organize memory",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId: "task-1",
    thinkingLevel: "off"
  };
}
