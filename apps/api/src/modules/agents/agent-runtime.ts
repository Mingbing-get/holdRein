import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  AgentHarness,
  JsonlSessionRepo,
  NodeExecutionEnv,
  convertToLlm,
  formatSkillsForSystemPrompt,
  loadSkills
} from "@earendil-works/pi-agent-core/node";
import {
  getModels,
  type Api,
  type KnownProvider,
  type Model
} from "@earendil-works/pi-ai";

import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus } from "./agent-event-bus";
import {
  type HarnessEvent,
  type ShellCommandApprovalRequest,
  type StartAgentInput,
  type StartAgentResult
} from "./agent-types";
import { createShellExecTool } from "./shell-exec-tool";
import { classifyShellCommandRisk } from "./shell-command-risk";

export interface AgentRuntime {
  start: (input: StartAgentInput) => Promise<StartAgentResult>;
}

export interface CreateAgentRuntimeOptions {
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  getApiKey?: (provider: string, modelId: string) => Promise<string | undefined>;
  skillDirs?: string[];
}

interface RunningAgent {
  harness: AgentHarness;
  sessionId: string;
}

export function createAgentRuntime(
  options: CreateAgentRuntimeOptions
): AgentRuntime {
  const runningAgents = new Map<string, RunningAgent>();

  return {
    start: async (input) => {
      const agentId = `agent_${randomUUID()}`;
      const env = new NodeExecutionEnv({ cwd: input.workspacePath });
      const sessionRepo = new JsonlSessionRepo({
        fs: env,
        sessionsRoot: ".hold-rein/sessions"
      });
      const session = await sessionRepo.create({ cwd: input.workspacePath });
      const sessionMetadata = await session.getMetadata();
      const skillDirs = getSkillDirs(input.workspacePath, options.skillDirs);
      const { skills } = await loadSkills(env, skillDirs);
      const shellExecTool = createShellExecTool(env);
      const allowedCommandRoots = [
        input.workspacePath,
        ...skills.map((skill) => dirname(skill.filePath))
      ];
      const model = findBuiltInModel(input.provider, input.modelId);

      if (!model) {
        throw new Error("Unknown model");
      }

      const harness = new AgentHarness({
        activeToolNames: [shellExecTool.name],
        env,
        getApiKeyAndHeaders: async () => {
          const apiKey =
            (await options.getApiKey?.(input.provider, input.modelId)) ??
            getEnvApiKey(input.provider);

          return apiKey ? { apiKey } : undefined;
        },
        model,
        resources: { skills },
        session,
        systemPrompt: ({ resources }) =>
          [
            "You are a careful coding assistant running inside HoldRein.",
            "Use shell_exec for workspace commands and skill scripts.",
            "Resolve skill-relative references from each skill file directory.",
            formatSkillsForSystemPrompt(resources.skills ?? [])
          ]
            .filter(Boolean)
            .join("\n\n"),
        tools: [shellExecTool]
      });

      harness.subscribe((event) => {
        options.eventBus.emit({
          agentId,
          payload: serializeHarnessEvent(event),
          type: event.type
        });
      });

      harness.on("context", (event) => ({
        messages: convertToLlm(event.messages)
      }));

      harness.on("tool_call", async (event) => {
        if (event.toolName !== shellExecTool.name) {
          return undefined;
        }

        const command = getStringValue(event.input.command);
        const cwd = getStringValue(event.input.cwd) ?? input.workspacePath;

        if (!command) {
          return { block: true, reason: "shell_exec command must be a string" };
        }

        if (!isPathInsideAny(cwd, allowedCommandRoots)) {
          return { block: true, reason: `cwd is outside allowed roots: ${cwd}` };
        }

        const risk = classifyShellCommandRisk(command);

        if (risk === "safe") {
          return undefined;
        }

        const approvalId = `approval_${randomUUID()}`;
        const approvalRequest: ShellCommandApprovalRequest = {
          agentId,
          approvalId,
          command,
          cwd,
          risk
        };
        const approval = options.approvalStore.request(approvalRequest);
        options.eventBus.emit({
          agentId,
          payload: approvalRequest,
          type: "approval_requested"
        });

        return (await approval)
          ? undefined
          : { block: true, reason: `User denied shell command: ${command}` };
      });

      runningAgents.set(agentId, { harness, sessionId: sessionMetadata.id });

      void harness.prompt(input.prompt).catch((error) => {
        options.eventBus.emit({
          agentId,
          payload: {
            message:
              error instanceof Error ? error.message : "Agent run failed"
          },
          type: "agent_error"
        });
      });

      return {
        agentId,
        sessionId: sessionMetadata.id,
        status: "running"
      };
    }
  };
}

function getSkillDirs(workspacePath: string, configuredSkillDirs?: string[]): string[] {
  return configuredSkillDirs ?? [
    join(workspacePath, ".hold-rein", "skills"),
    join(homedir(), ".hold-rein", "skills")
  ];
}

function findBuiltInModel(provider: string, modelId: string): Model<Api> | null {
  try {
    return (
      getModels(provider as KnownProvider).find((model) => model.id === modelId) ??
      null
    );
  } catch {
    return null;
  }
}

function getEnvApiKey(provider: string): string | undefined {
  return process.env[`${provider.toUpperCase()}_API_KEY`];
}


function serializeHarnessEvent(event: HarnessEvent): unknown {
  if (event.type === "message_update") {
    return {
      assistantMessageEvent: event.assistantMessageEvent,
      message: event.message
    };
  }

  return event;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function isPathInsideAny(path: string, roots: string[]): boolean {
  const resolvedPath = resolve(path);

  return roots.some((root) => {
    const resolvedRoot = resolve(root);
    const relativePath = relative(resolvedRoot, resolvedPath);

    return (
      relativePath === "" ||
      (!relativePath.startsWith("..") && !isAbsolute(relativePath))
    );
  });
}
