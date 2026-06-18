import { eq } from "drizzle-orm";

import {
  subagents,
  type AppDatabase,
  type NewSubagentRow,
  type SubagentRow
} from "../../../db";

export interface SubagentRepository {
  create: (subagent: NewSubagentRow) => SubagentRow;
  delete: (agentId: string) => void;
  findByAgentId: (agentId: string) => SubagentRow | undefined;
  findByTaskId: (taskId: string) => SubagentRow[];
  updateStatus: (
    agentId: string,
    status: SubagentRow["status"],
    updatedAt: string
  ) => SubagentRow | undefined;
}

export function createInMemorySubagentRepository(
  seed: SubagentRow[] = []
): SubagentRepository {
  const rows = new Map(seed.map((row) => [row.agentId, { ...row }]));

  return {
    create: (subagent) => {
      if (rows.has(subagent.agentId)) {
        throw new Error(`Subagent already exists: ${subagent.agentId}`);
      }
      const row = { ...subagent } as SubagentRow;
      rows.set(row.agentId, row);
      return row;
    },
    delete: (agentId) => {
      rows.delete(agentId);
    },
    findByAgentId: (agentId) => rows.get(agentId),
    findByTaskId: (taskId) =>
      Array.from(rows.values()).filter((row) => row.taskId === taskId),
    updateStatus: (agentId, status, updatedAt) => {
      const existing = rows.get(agentId);
      if (!existing) return undefined;
      const row = { ...existing, status, updatedAt };
      rows.set(agentId, row);
      return row;
    }
  };
}

export function createSqliteSubagentRepository(
  database: AppDatabase
): SubagentRepository {
  return {
    create: (subagent) => {
      database.db.insert(subagents).values(subagent).run();
      return database.db
        .select()
        .from(subagents)
        .where(eq(subagents.agentId, subagent.agentId))
        .get() as SubagentRow;
    },
    delete: (agentId) => {
      database.db.delete(subagents).where(eq(subagents.agentId, agentId)).run();
    },
    findByAgentId: (agentId) =>
      database.db
        .select()
        .from(subagents)
        .where(eq(subagents.agentId, agentId))
        .get(),
    findByTaskId: (taskId) =>
      database.db
        .select()
        .from(subagents)
        .where(eq(subagents.taskId, taskId))
        .all(),
    updateStatus: (agentId, status, updatedAt) => {
      database.db
        .update(subagents)
        .set({ status, updatedAt })
        .where(eq(subagents.agentId, agentId))
        .run();
      return database.db
        .select()
        .from(subagents)
        .where(eq(subagents.agentId, agentId))
        .get();
    }
  };
}
