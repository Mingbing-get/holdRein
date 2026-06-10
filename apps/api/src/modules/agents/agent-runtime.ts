import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  AgentHarness,
  JsonlSessionRepo,
  NodeExecutionEnv,
  formatSkillsForSystemPrompt,
  loadSkills
} from "@earendil-works/pi-agent-core/node";
import { AGENT_ROOT_DIR, SESSION_DIR_NAME } from '../../config/const';
import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus } from "./agent-event-bus";
import type { AgentMessageRepository } from "./agent-message-repository";
import { toStoredAgentMessage } from "./agent-message-storage";
import {
  resolveAgentModel,
  type AgentModelLookup
} from "./agent-model-resolver";
import {
  type AgentRunResult,
  type ShellCommandApprovalRequest,
  type RunAgentInput
} from "./agent-types";
import { createShellExecTool } from "./shell-exec-tool";
import { classifyShellCommandRisk } from "./shell-command-risk";

export interface AgentRuntime {
  start: (input: RunAgentInput) => Promise<AgentRunResult>;
}

export interface CreateAgentRuntimeOptions {
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  messageRepository: AgentMessageRepository;
  getApiKey?: (provider: string, modelId: string) => Promise<string | undefined>;
  getCustomModel?: AgentModelLookup;
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
        fs: new NodeExecutionEnv({ cwd: AGENT_ROOT_DIR }),
        sessionsRoot: `./${SESSION_DIR_NAME}`
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
      const model = await resolveAgentModel(
        input.provider,
        input.modelId,
        options.getCustomModel
      );

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

      for (const message of input.history ?? []) {
        await harness.appendMessage(message);
      }

      let activeMessageId: string | undefined;
      harness.subscribe((event) => {
        if (event.type === "message_start") {
          activeMessageId = `message_${randomUUID()}`;
          options.eventBus.emit({
            agentId,
            payload: { message: toStoredAgentMessage(activeMessageId, event.message) },
            type: "message_start"
          });
          return;
        }
        if (event.type === "message_update" && activeMessageId) {
          options.eventBus.emit({
            agentId,
            payload: {
              delta: event.assistantMessageEvent,
              messageId: activeMessageId
            },
            type: "message_delta"
          });
          return;
        }
        if (event.type === "message_end") {
          const messageId = activeMessageId ?? `message_${randomUUID()}`;
          const message = toStoredAgentMessage(messageId, event.message);
          options.messageRepository.append({
            agentId,
            createdAt: new Date().toISOString(),
            message,
            taskId: input.taskId
          });
          options.eventBus.emit({
            agentId,
            payload: { message },
            type: "message_end"
          });
          activeMessageId = undefined;
          return;
        }
        if (event.type === "agent_end") {
          options.eventBus.emit({ agentId, type: "agent_end" });
        }
      });

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

function getEnvApiKey(provider: string): string | undefined {
  return process.env[`${provider.toUpperCase()}_API_KEY`];
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
