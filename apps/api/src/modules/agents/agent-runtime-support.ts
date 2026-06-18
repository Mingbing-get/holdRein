import { homedir } from "node:os";
import { join } from "node:path";

import {
  JsonlSessionRepo,
  NodeExecutionEnv,
  type AgentHarness,
  type JsonlSessionRepoApi
} from "@earendil-works/pi-agent-core/node";

import { SESSIONS_DIR } from "../../config/const";
import type { AgentSessionMetadata } from "./agent-types";

interface InterruptibleHarness {
  abort?: () => Promise<unknown> | unknown;
  interrupt?: () => Promise<unknown> | unknown;
}

export async function interruptHarness(harness: AgentHarness): Promise<void> {
  const interruptibleHarness = harness as unknown as InterruptibleHarness;

  if (interruptibleHarness.interrupt) {
    await interruptibleHarness.interrupt();
    return;
  }

  if (interruptibleHarness.abort) {
    await interruptibleHarness.abort();
    return;
  }

  throw new Error("Agent runtime does not support interruption");
}

export function createSessionRepo(): JsonlSessionRepoApi {
  return new JsonlSessionRepo({
    fs: new NodeExecutionEnv({ cwd: SESSIONS_DIR }),
    sessionsRoot: SESSIONS_DIR
  });
}

export function getSkillDirs(
  workspacePath: string,
  configuredSkillDirs?: string[]
): string[] {
  return configuredSkillDirs ?? [
    join(workspacePath, ".hold-rein", "skills"),
    join(homedir(), ".hold-rein", "skills")
  ];
}

export function getEnvApiKey(provider: string): string | undefined {
  return process.env[`${provider.toUpperCase()}_API_KEY`];
}

export function toAgentSessionMetadata(metadata: {
  createdAt: string;
  id: string;
  path: string;
}): AgentSessionMetadata {
  return {
    createdAt: metadata.createdAt,
    id: metadata.id,
    path: metadata.path
  };
}
