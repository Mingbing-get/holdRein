import { randomUUID } from "node:crypto";

import { asc, eq, gte } from "drizzle-orm";

import type {
  AppDatabase,
  ModelProxyCandidateLimitRow,
  ModelProxyCandidateRow,
  ModelProxyRow,
  ModelTokenUsageHourlyRow
} from "../../db";
import {
  modelProxies,
  modelProxyCandidateLimits,
  modelProxyCandidates,
  modelTokenUsageHourly
} from "../../db";

export type ModelProxyWindowType = "hours" | "day" | "week";

export interface ModelProxyLimitInput {
  maxTokens: number;
  windowHours?: number | null;
  windowType: ModelProxyWindowType;
}

export interface ModelProxyCandidateInput {
  limits: ModelProxyLimitInput[];
  modelId: string;
  priority: number;
  provider: string;
}

export interface ModelProxyInput {
  candidates: ModelProxyCandidateInput[];
  modelId: string;
  name: string;
}

export interface ModelProxyRequestInput extends Omit<ModelProxyInput, "modelId"> {
  modelId?: string;
}

export interface ModelProxyDetails extends ModelProxyRow {
  candidates: (ModelProxyCandidateRow & { limits: ModelProxyCandidateLimitRow[] })[];
}

export interface ModelProxyRepository {
  createProxy: (input: ModelProxyInput) => ModelProxyDetails;
  deleteProxy: (modelId: string) => boolean;
  findProxyByModelId: (modelId: string) => ModelProxyDetails | undefined;
  listProxies: () => ModelProxyDetails[];
  updateProxy: (modelId: string, input: ModelProxyInput) => ModelProxyDetails | undefined;
}

export interface ModelProxyUsageRepository {
  listModelTokenUsageSince: (from: string) => ModelTokenUsageHourlyRow[];
}

export function createInMemoryModelProxyRepository(): ModelProxyRepository {
  const proxies = new Map<string, ModelProxyDetails>();

  const save = (input: ModelProxyInput, existing?: ModelProxyDetails) => {
    const now = new Date().toISOString();
    const proxy: ModelProxyDetails = {
      candidates: input.candidates
        .map((candidate) => {
          const candidateId = randomUUID();
          return {
            createdAt: now,
            id: candidateId,
            limits: candidate.limits.map((limit) => ({
              candidateId,
              createdAt: now,
              id: randomUUID(),
              maxTokens: limit.maxTokens,
              updatedAt: now,
              windowHours: limit.windowHours ?? null,
              windowType: limit.windowType
            })),
            modelId: candidate.modelId,
            priority: candidate.priority,
            provider: candidate.provider,
            proxyId: existing?.id ?? randomUUID(),
            updatedAt: now
          };
        })
        .sort((left, right) => left.priority - right.priority),
      createdAt: existing?.createdAt ?? now,
      id: existing?.id ?? randomUUID(),
      modelId: input.modelId,
      name: input.name,
      updatedAt: now
    };
    proxy.candidates = proxy.candidates.map((candidate) => ({
      ...candidate,
      proxyId: proxy.id
    }));
    proxies.delete(existing?.modelId ?? input.modelId);
    proxies.set(proxy.modelId, proxy);
    return cloneProxy(proxy);
  };

  return {
    createProxy: (input) => save(input),
    deleteProxy: (modelId) => proxies.delete(modelId),
    findProxyByModelId: (modelId) => cloneOptional(proxies.get(modelId)),
    listProxies: () => [...proxies.values()].map(cloneProxy),
    updateProxy: (modelId, input) => {
      const existing = proxies.get(modelId);
      return existing ? save(input, existing) : undefined;
    }
  };
}

export function createSqliteModelProxyRepository(
  database: AppDatabase
): ModelProxyRepository & ModelProxyUsageRepository {
  const readProxy = (row: ModelProxyRow): ModelProxyDetails => ({
    ...row,
    candidates: database.db
      .select()
      .from(modelProxyCandidates)
      .where(eq(modelProxyCandidates.proxyId, row.id))
      .orderBy(asc(modelProxyCandidates.priority))
      .all()
      .map((candidate) => ({
        ...candidate,
        limits: database.db
          .select()
          .from(modelProxyCandidateLimits)
          .where(eq(modelProxyCandidateLimits.candidateId, candidate.id))
          .all()
      }))
  });

  const insertProxy = (input: ModelProxyInput, existing?: ModelProxyRow) => {
    const now = new Date().toISOString();
    const proxy: ModelProxyRow = {
      createdAt: existing?.createdAt ?? now,
      id: existing?.id ?? randomUUID(),
      modelId: input.modelId,
      name: input.name,
      updatedAt: now
    };
    if (existing) {
      database.db.update(modelProxies).set(proxy).where(eq(modelProxies.id, existing.id)).run();
      database.db.delete(modelProxyCandidates).where(eq(modelProxyCandidates.proxyId, proxy.id)).run();
    } else {
      database.db.insert(modelProxies).values(proxy).run();
    }
    for (const candidate of input.candidates) {
      const candidateRow: ModelProxyCandidateRow = {
        createdAt: now,
        id: randomUUID(),
        modelId: candidate.modelId,
        priority: candidate.priority,
        provider: candidate.provider,
        proxyId: proxy.id,
        updatedAt: now
      };
      database.db.insert(modelProxyCandidates).values(candidateRow).run();
      database.db.insert(modelProxyCandidateLimits).values(candidate.limits.map((limit) => ({
        candidateId: candidateRow.id,
        createdAt: now,
        id: randomUUID(),
        maxTokens: limit.maxTokens,
        updatedAt: now,
        windowHours: limit.windowHours ?? null,
        windowType: limit.windowType
      }))).run();
    }
    return readProxy(proxy);
  };

  return {
    createProxy: (input) => insertProxy(input),
    deleteProxy: (modelId) => {
      const row = database.db.select().from(modelProxies).where(eq(modelProxies.modelId, modelId)).get();
      if (!row) return false;
      database.db.delete(modelProxies).where(eq(modelProxies.id, row.id)).run();
      return true;
    },
    findProxyByModelId: (modelId) => {
      const row = database.db.select().from(modelProxies).where(eq(modelProxies.modelId, modelId)).get();
      return row ? readProxy(row) : undefined;
    },
    listModelTokenUsageSince: (from) =>
      database.db.select().from(modelTokenUsageHourly).where(gte(modelTokenUsageHourly.hour, from)).all(),
    listProxies: () => database.db.select().from(modelProxies).all().map(readProxy),
    updateProxy: (modelId, input) => {
      const row = database.db.select().from(modelProxies).where(eq(modelProxies.modelId, modelId)).get();
      return row ? insertProxy(input, row) : undefined;
    }
  };
}

function cloneOptional(proxy: ModelProxyDetails | undefined) {
  return proxy ? cloneProxy(proxy) : undefined;
}

function cloneProxy(proxy: ModelProxyDetails): ModelProxyDetails {
  return {
    ...proxy,
    candidates: proxy.candidates.map((candidate) => ({
      ...candidate,
      limits: candidate.limits.map((limit) => ({ ...limit }))
    }))
  };
}
