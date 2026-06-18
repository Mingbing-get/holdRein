import type { AgentEventBus } from "../event/event-bus";
import { appendVisibleCustomMessage } from "./messages";
import { formatSubagentResult, type SubagentRun } from "../subagent";

const SUBAGENT_RESULT_CUSTOM_TYPE = "subagent_result";

interface VisibleCustomMessageSession {
  appendCustomMessageEntry: (
    customType: string,
    content: string,
    display: boolean,
    details?: unknown
  ) => Promise<unknown>;
}

export function addPendingSubagentResult(
  pendingSubagentResults: Map<string, Set<string>>,
  agentId: string,
  subagentId: string
): void {
  const pending = pendingSubagentResults.get(agentId) ?? new Set<string>();
  pending.add(subagentId);
  pendingSubagentResults.set(agentId, pending);
}

export async function flushPendingSubagentResults<
  Session extends VisibleCustomMessageSession
>(input: {
  agentId: string;
  eventBus: AgentEventBus;
  pendingSubagentResults: Map<string, Set<string>>;
  session: Session;
  subagents: Map<string, SubagentRun<Session>>;
}): Promise<void> {
  const pending = input.pendingSubagentResults.get(input.agentId);
  if (!pending) return;
  for (const subagentId of pending) {
    const subagent = input.subagents.get(subagentId);
    if (subagent && !subagent.consumed) {
      await appendSubagentResult({ ...input, subagent });
      input.subagents.delete(subagentId);
    }
  }
  input.pendingSubagentResults.delete(input.agentId);
}

export async function appendSubagentResult<
  Session extends VisibleCustomMessageSession
>(input: {
  agentId: string;
  eventBus: AgentEventBus;
  pendingSubagentResults: Map<string, Set<string>>;
  session: Session;
  subagent: SubagentRun<Session>;
}): Promise<string> {
  const prompt = formatSubagentResult(input.subagent);
  await appendVisibleCustomMessage({
    agentId: input.agentId,
    content: prompt,
    customType: SUBAGENT_RESULT_CUSTOM_TYPE,
    details: {
      agentId: input.subagent.agentId,
      agentName: input.subagent.agentName,
      session: input.subagent.session
    },
    eventBus: input.eventBus,
    session: input.session
  });
  input.subagent.consumed = true;
  input.pendingSubagentResults.get(input.agentId)?.delete(input.subagent.agentId);
  return prompt;
}
