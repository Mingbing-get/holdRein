import { asc, desc, eq } from "drizzle-orm";

import type { AppDatabase } from "../../db";
import { taskMessages } from "../../db";
import type { StoredAgentMessage } from "./agent-types";

export interface AppendTaskMessageInput {
  agentId: string;
  createdAt: string;
  message: StoredAgentMessage;
  taskId: string;
}

export interface StoredTaskMessage {
  agentId: string;
  createdAt: string;
  message: StoredAgentMessage;
  sequence: number;
  taskId: string;
}

export interface AgentMessageRepository {
  append: (input: AppendTaskMessageInput) => StoredTaskMessage;
  listByTaskId: (taskId: string) => StoredTaskMessage[];
}

export function createInMemoryAgentMessageRepository(): AgentMessageRepository {
  const rows: StoredTaskMessage[] = [];

  return {
    append: (input) => {
      const row = {
        ...input,
        sequence:
          Math.max(
            0,
            ...rows
              .filter((candidate) => candidate.taskId === input.taskId)
              .map((candidate) => candidate.sequence)
          ) + 1
      };
      rows.push(row);
      return row;
    },
    listByTaskId: (taskId) =>
      rows
        .filter((row) => row.taskId === taskId)
        .sort((left, right) => left.sequence - right.sequence)
  };
}

export function createSqliteAgentMessageRepository(
  database: AppDatabase
): AgentMessageRepository {
  return {
    append: (input) => {
      const latest = database.db
        .select({ sequence: taskMessages.sequence })
        .from(taskMessages)
        .where(eq(taskMessages.taskId, input.taskId))
        .orderBy(desc(taskMessages.sequence))
        .get();
      const sequence = (latest?.sequence ?? 0) + 1;
      database.db
        .insert(taskMessages)
        .values({
          agentId: input.agentId,
          createdAt: input.createdAt,
          id: input.message.id,
          payload: JSON.stringify(input.message),
          role: input.message.role,
          sequence,
          taskId: input.taskId,
          updatedAt: input.createdAt
        })
        .run();

      return { ...input, sequence };
    },
    listByTaskId: (taskId) =>
      database.db
        .select()
        .from(taskMessages)
        .where(eq(taskMessages.taskId, taskId))
        .orderBy(asc(taskMessages.sequence))
        .all()
        .map((row) => ({
          agentId: row.agentId,
          createdAt: row.createdAt,
          message: JSON.parse(row.payload) as StoredAgentMessage,
          sequence: row.sequence,
          taskId: row.taskId
        }))
  };
}
