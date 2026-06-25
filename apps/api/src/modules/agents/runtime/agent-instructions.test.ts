import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRuntime, createRunInput, createSessionRepo } from "./test-utils";

const harnessConstructor = vi.fn();
const prompt = vi.fn().mockResolvedValue(undefined);
const resolveContributions = vi.hoisted(() => vi.fn().mockResolvedValue({
  skillDirs: [],
  skills: [],
  systemPrompts: [],
  tools: []
}));

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      on = vi.fn();
      prompt = prompt;
      subscribe = vi.fn();

      constructor(options: unknown) {
        harnessConstructor(options);
      }
    },
    NodeExecutionEnv: class {
      constructor(readonly options: unknown) {}
    },
    loadSkills: vi.fn().mockResolvedValue({ diagnostics: [], skills: [] })
  };
});

vi.mock("../../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime workspace instructions", () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), "hold-rein-agents-"));
    harnessConstructor.mockClear();
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue({
      skillDirs: [],
      skills: [],
      systemPrompts: [],
      tools: []
    });
  });

  afterEach(async () => {
    await rm(workspacePath, { force: true, recursive: true });
  });

  it("inserts workspace AGENTS.md content into the system prompt", async () => {
    await writeFile(
      join(workspacePath, "AGENTS.md"),
      "Always run the safety checks before editing.\n",
      "utf8"
    );
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start({ ...createRunInput(), workspacePath });

    const systemPrompt = harnessConstructor.mock.calls[0]?.[0]
      ?.systemPrompt as
      | ((input: { resources: { skills: unknown[] } }) => string)
      | undefined;
    const promptText = systemPrompt?.({ resources: { skills: [] } });

    expect(promptText).toContain("Workspace AGENTS.md mandatory constraints:");
    expect(promptText).toContain("Always run the safety checks before editing.");
  });

  it("does not inject workspace instructions when AGENTS.md is missing", async () => {
    await mkdir(join(workspacePath, "nested"));
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start({ ...createRunInput(), workspacePath });

    const systemPrompt = harnessConstructor.mock.calls[0]?.[0]
      ?.systemPrompt as
      | ((input: { resources: { skills: unknown[] } }) => string)
      | undefined;
    const promptText = systemPrompt?.({ resources: { skills: [] } });

    expect(promptText).not.toContain("Workspace AGENTS.md mandatory constraints:");
  });

  it("merges request-scoped skills and system prompts", async () => {
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start({
      ...createRunInput(),
      runtimeContributions: {
        skills: [{ content: "# Browser Skill", name: "browser-skill" }],
        systemPrompts: ["Browser system prompt."]
      },
      workspacePath
    });

    const options = harnessConstructor.mock.calls[0]?.[0] as
      | {
          resources?: { skills?: { name: string }[] };
          systemPrompt?: (input: { resources: { skills: unknown[] } }) => string;
        }
      | undefined;

    expect(options?.resources?.skills).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "browser-skill" })])
    );
    expect(options?.systemPrompt?.({ resources: { skills: [] } })).toContain(
      "Browser system prompt."
    );
  });
});
