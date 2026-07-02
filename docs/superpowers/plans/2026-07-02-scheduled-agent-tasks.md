# Scheduled Agent Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side scheduled agent tasks that start new agent conversations on cron schedules, using selected workspace, prompt, model, thinking level, and optional concurrency blocking.

**Architecture:** Add a dedicated API module for persisted scheduled task configuration, use `node-cron` to register enabled jobs at server startup and after mutations, and use `cron-parser` to compute displayable `nextRunAt` timestamps. Scheduled executions call the existing `AgentsService.startAgent` path with `approvalPolicy: "run_all"` and tag created tasks through `tasks.sourceType/sourceMark`.

**Tech Stack:** Strict TypeScript, Express, Drizzle SQLite, Vitest, `node-cron`, `cron-parser`.

---

### File Structure

- Modify: `apps/api/package.json` - add `node-cron`, `cron-parser`, and type dependency if needed.
- Modify: `apps/api/src/db/schema.ts` - add `scheduledAgentTasks` table and `tasks.sourceType/sourceMark`.
- Modify: `apps/api/src/db/migrate.ts` - create the scheduled table, indexes, and task source columns.
- Modify: `apps/api/src/modules/agents/agent-types.ts` - add agent task source input type.
- Modify: `apps/api/src/modules/agents/service/index.ts` - persist source fields on task creation.
- Modify: `apps/api/src/modules/workspaces/workspace-repository.ts` - support querying running tasks by source.
- Create: `apps/api/src/modules/scheduled-tasks/index.ts` - public module exports.
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-types.ts` - public input/output types.
- Create: `apps/api/src/modules/scheduled-tasks/cron.ts` - cron validation and `nextRunAt` calculation.
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-repository.ts` - in-memory and SQLite persistence.
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-task-scheduler.ts` - `node-cron` registration and execution.
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-service.ts` - validation, CRUD, enable/disable, scheduler refresh.
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-router.ts` - `/api/v1/scheduled-tasks` routes.
- Modify: `apps/api/src/router/v1/index.ts` - mount the scheduled task router.
- Modify: `apps/api/src/runtime.ts` - start the default scheduled task service after default agent service creation.
- Test: `apps/api/src/db/database.test.ts`
- Test: `apps/api/src/modules/agents/service/index.test.ts`
- Test: `apps/api/src/modules/workspaces/workspace-repository.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/cron.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-repository.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-task-scheduler.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-service.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-router.test.ts`

---

### Task 1: Dependencies And Database Shape

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/db/migrate.ts`
- Test: `apps/api/src/db/database.test.ts`

- [ ] **Step 1: Add dependency declarations**

Add runtime dependencies to `apps/api/package.json`:

```json
{
  "dependencies": {
    "cron-parser": "latest",
    "node-cron": "latest"
  }
}
```

If TypeScript reports missing `node-cron` declarations during Task 5 or Task 8, add this dev dependency:

```json
{
  "devDependencies": {
    "@types/node-cron": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `corepack pnpm install`

Expected: `pnpm-lock.yaml` updates and the install exits successfully.

- [ ] **Step 3: Write failing database migration/schema tests**

In `apps/api/src/db/database.test.ts`, add assertions that a migrated database accepts:

```ts
db.insert(tasks).values({
  createdAt: "2026-07-02T00:00:00.000Z",
  id: "task-scheduled",
  initialUserMessage: "Run scheduled check",
  lastContinuedAt: "2026-07-02T00:00:00.000Z",
  lastModelName: "gpt-4.1",
  lastModelProvider: "openai",
  lastModelProviderSource: "built_in",
  sourceMark: "scheduled-1",
  sourceType: "scheduled",
  status: "running",
  thinkingLevel: "medium",
  title: "",
  updatedAt: "2026-07-02T00:00:00.000Z",
  workspaceId: "workspace-1"
});

db.insert(scheduledAgentTasks).values({
  allowConcurrentRuns: false,
  createdAt: "2026-07-02T00:00:00.000Z",
  cronExpression: "*/5 * * * *",
  enabled: true,
  id: "scheduled-1",
  lastRunAt: null,
  modelId: "gpt-4.1",
  name: "Every five minutes",
  nextRunAt: "2026-07-02T00:05:00.000Z",
  prompt: "Run scheduled check",
  provider: "openai",
  thinkingLevel: "medium",
  timezone: "Asia/Shanghai",
  updatedAt: "2026-07-02T00:00:00.000Z",
  workspacePath: "/tmp/workspace"
});
```

Also assert an existing task insert that omits source fields reads back `sourceType: "manual"` and `sourceMark: null`.

- [ ] **Step 4: Verify tests fail**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/db/database.test.ts`

Expected: FAIL because `scheduledAgentTasks`, `sourceType`, and `sourceMark` do not exist.

- [ ] **Step 5: Implement schema**

In `apps/api/src/db/schema.ts`, add `sourceType` and `sourceMark` to `tasks`, add the scheduled table, and export inferred row types:

```ts
sourceType: text("source_type", {
  enum: ["manual", "scheduled"]
}).notNull().default("manual"),
sourceMark: text("source_mark")
```

```ts
export const scheduledAgentTasks = sqliteTable(
  "scheduled_agent_tasks",
  {
    allowConcurrentRuns: integer("allow_concurrent_runs", {
      mode: "boolean"
    }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    cronExpression: text("cron_expression").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    id: text("id").primaryKey(),
    lastRunAt: text("last_run_at"),
    modelId: text("model_id").notNull(),
    name: text("name").notNull(),
    nextRunAt: text("next_run_at"),
    prompt: text("prompt").notNull(),
    provider: text("provider").notNull(),
    thinkingLevel: text("thinking_level", {
      enum: ["off", "minimal", "low", "medium", "high", "xhigh"]
    }).notNull().default("medium"),
    timezone: text("timezone").notNull(),
    updatedAt: text("updated_at").notNull(),
    workspacePath: text("workspace_path").notNull()
  },
  (table) => ({
    enabledIndex: index("scheduled_agent_tasks_enabled_idx").on(table.enabled)
  })
);
```

Add a `tasksSourceIndex` on `(sourceType, sourceMark)`.

- [ ] **Step 6: Implement migrations**

In `apps/api/src/db/migrate.ts`, add create table SQL for `scheduled_agent_tasks`, an enabled index, a task source index, and idempotent source columns:

```sql
ALTER TABLE tasks ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'
CHECK(source_type IN ('manual', 'scheduled'))
```

```sql
ALTER TABLE tasks ADD COLUMN source_mark TEXT
```

Run `sqlite.exec` for the scheduled table/index and `addColumnIfMissing` for the task columns.

- [ ] **Step 7: Verify database tests pass**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/db/database.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/db/schema.ts apps/api/src/db/migrate.ts apps/api/src/db/database.test.ts
git commit -m "feat(api): add scheduled task persistence schema"
```

---

### Task 2: Task Source Metadata In Agents Service

**Files:**
- Modify: `apps/api/src/modules/agents/agent-types.ts`
- Modify: `apps/api/src/modules/agents/service/index.ts`
- Modify: `apps/api/src/modules/workspaces/workspace-repository.ts`
- Test: `apps/api/src/modules/agents/service/index.test.ts`
- Test: `apps/api/src/modules/workspaces/workspace-repository.test.ts`

- [ ] **Step 1: Write failing source metadata tests**

In `apps/api/src/modules/agents/service/index.test.ts`, add a test that starts an agent with:

```ts
source: { mark: "scheduled-1", type: "scheduled" }
```

Assert the created task contains:

```ts
sourceMark: "scheduled-1",
sourceType: "scheduled"
```

Add a second assertion to the existing normal start test that manual starts default to:

```ts
sourceMark: null,
sourceType: "manual"
```

- [ ] **Step 2: Write failing running-source repository tests**

In `apps/api/src/modules/workspaces/workspace-repository.test.ts`, add coverage for both repository implementations:

```ts
expect(
  repository.findRunningTaskBySource({
    sourceMark: "scheduled-1",
    sourceType: "scheduled"
  })?.id
).toBe("running-scheduled-task");
```

Also assert completed tasks and manual tasks do not match.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/agents/service/index.test.ts src/modules/workspaces/workspace-repository.test.ts
```

Expected: FAIL because source input and `findRunningTaskBySource` do not exist.

- [ ] **Step 4: Add public input type**

In `apps/api/src/modules/agents/agent-types.ts`, add:

```ts
export interface AgentTaskSourceInput {
  mark?: string;
  type: "manual" | "scheduled";
}
```

Add `source?: AgentTaskSourceInput` to `StartAgentInput`.

- [ ] **Step 5: Persist source in task creation**

In `apps/api/src/modules/agents/service/index.ts`, compute:

```ts
const sourceType = input.source?.type ?? "manual";
const sourceMark = sourceType === "scheduled" ? input.source?.mark ?? null : null;
```

Pass `sourceType` and `sourceMark` into `options.repository.createTask`.

- [ ] **Step 6: Add running source repository method**

Extend `WorkspaceRepository`:

```ts
findRunningTaskBySource: (input: {
  sourceMark: string;
  sourceType: "scheduled";
}) => TaskRow | undefined;
```

Implement in-memory filtering with `status === "running"`. Implement SQLite with `eq(tasks.sourceType, input.sourceType)`, `eq(tasks.sourceMark, input.sourceMark)`, and `eq(tasks.status, "running")`.

- [ ] **Step 7: Verify tests pass**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/agents/service/index.test.ts src/modules/workspaces/workspace-repository.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/api/src/modules/agents/agent-types.ts apps/api/src/modules/agents/service/index.ts apps/api/src/modules/workspaces/workspace-repository.ts apps/api/src/modules/agents/service/index.test.ts apps/api/src/modules/workspaces/workspace-repository.test.ts
git commit -m "feat(api): tag agent tasks by source"
```

---

### Task 3: Scheduled Task Repository And Cron Helpers

**Files:**
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-types.ts`
- Create: `apps/api/src/modules/scheduled-tasks/cron.ts`
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-repository.ts`
- Create: `apps/api/src/modules/scheduled-tasks/index.ts`
- Test: `apps/api/src/modules/scheduled-tasks/cron.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-repository.test.ts`

- [ ] **Step 1: Write failing cron helper tests**

Create `cron.test.ts` with cases for:

```ts
expect(isValidCronExpression("*/5 * * * *")).toBe(true);
expect(isValidCronExpression("not cron")).toBe(false);
expect(
  getNextRunAt({
    expression: "*/5 * * * *",
    now: new Date("2026-07-02T00:01:00.000Z"),
    timezone: "Asia/Shanghai"
  })
).toBe("2026-07-02T00:05:00.000Z");
```

- [ ] **Step 2: Write failing repository tests**

Create `scheduled-tasks-repository.test.ts` covering in-memory and SQLite repositories:

- `createScheduledTask`
- `findScheduledTaskById`
- `listScheduledTasks`
- `listEnabledScheduledTasks`
- `updateScheduledTask`
- `deleteScheduledTaskById`
- `updateScheduledTaskRunMetadata`

Use `allowConcurrentRuns: false`, `enabled: true`, and `cronExpression: "*/5 * * * *"` in seed rows.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/cron.test.ts src/modules/scheduled-tasks/scheduled-tasks-repository.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Add types**

In `scheduled-tasks-types.ts`, export:

```ts
export type ScheduledTaskThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export interface ScheduledAgentTaskInput {
  allowConcurrentRuns: boolean;
  cronExpression: string;
  enabled?: boolean;
  modelId: string;
  name: string;
  prompt: string;
  provider: string;
  thinkingLevel: ScheduledTaskThinkingLevel;
  timezone: string;
  workspacePath: string;
}
```

- [ ] **Step 5: Add cron helpers**

In `cron.ts`, use `node-cron` for validation and `cron-parser` for next-run calculation:

```ts
export function isValidCronExpression(expression: string): boolean;
export function getNextRunAt(input: {
  expression: string;
  now: Date;
  timezone: string;
}): string;
```

Throw `Error("Invalid cron expression")` when `cron-parser` cannot parse the expression or timezone.

- [ ] **Step 6: Add repository implementations**

In `scheduled-tasks-repository.ts`, export:

```ts
export interface ScheduledTasksRepository {
  createScheduledTask: (task: NewScheduledAgentTaskRow) => ScheduledAgentTaskRow;
  deleteScheduledTaskById: (id: string) => void;
  findScheduledTaskById: (id: string) => ScheduledAgentTaskRow | undefined;
  listEnabledScheduledTasks: () => ScheduledAgentTaskRow[];
  listScheduledTasks: () => ScheduledAgentTaskRow[];
  updateScheduledTask: (
    id: string,
    patch: Partial<NewScheduledAgentTaskRow>
  ) => ScheduledAgentTaskRow | undefined;
  updateScheduledTaskRunMetadata: (
    id: string,
    metadata: { lastRunAt: string; nextRunAt: string; updatedAt: string }
  ) => ScheduledAgentTaskRow | undefined;
}
```

Implement `createInMemoryScheduledTasksRepository` and `createSqliteScheduledTasksRepository`.

- [ ] **Step 7: Export module API**

In `index.ts`, export types, cron helpers, and repository factory functions.

- [ ] **Step 8: Verify tests pass**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/cron.test.ts src/modules/scheduled-tasks/scheduled-tasks-repository.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/api/src/modules/scheduled-tasks
git commit -m "feat(api): add scheduled task repository"
```

---

### Task 4: Scheduled Task Scheduler

**Files:**
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-task-scheduler.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-task-scheduler.test.ts`

- [ ] **Step 1: Write failing scheduler tests**

Use fake `cron` and fake `agentsService` objects to test:

- `start()` registers enabled tasks only.
- `stop()` stops registered jobs.
- `reloadTask(id)` stops the old job and registers the updated enabled task.
- disabled tasks are not registered.
- trigger calls `agentsService.startAgent` with `approvalPolicy: "run_all"` and `source: { type: "scheduled", mark: id }`.
- when `allowConcurrentRuns` is false and `workspaceRepository.findRunningTaskBySource` returns a running task, trigger skips `startAgent`.
- trigger updates `lastRunAt` and `nextRunAt` after starting.

- [ ] **Step 2: Verify tests fail**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/scheduled-task-scheduler.test.ts`

Expected: FAIL because the scheduler does not exist.

- [ ] **Step 3: Implement scheduler**

Create `createScheduledTaskScheduler` with dependencies:

```ts
export interface ScheduledTaskScheduler {
  reloadAll: () => void;
  reloadTask: (id: string) => void;
  start: () => void;
  stop: () => void;
}
```

Dependencies:

```ts
agentsService: Pick<AgentsService, "startAgent">;
now?: () => Date;
repository: ScheduledTasksRepository;
workspaceRepository: Pick<WorkspaceRepository, "findRunningTaskBySource">;
```

Internally store jobs in `Map<string, ScheduledTask>`. Register with:

```ts
cron.schedule(task.cronExpression, () => {
  void runScheduledTask(task.id);
}, { timezone: task.timezone });
```

- [ ] **Step 4: Implement execution guard**

Before starting an agent, re-read the scheduled task by id. Return early if missing or disabled. If `allowConcurrentRuns` is false, call `workspaceRepository.findRunningTaskBySource({ sourceType: "scheduled", sourceMark: task.id })`; return early if it finds a row.

- [ ] **Step 5: Implement execution start**

Call:

```ts
await agentsService.startAgent({
  approvalPolicy: "run_all",
  modelId: task.modelId,
  prompt: task.prompt,
  provider: task.provider,
  source: { mark: task.id, type: "scheduled" },
  thinkingLevel: task.thinkingLevel,
  workspacePath: task.workspacePath
});
```

Then update run metadata with `lastRunAt = now().toISOString()` and `nextRunAt = getNextRunAt(...)`.

- [ ] **Step 6: Verify tests pass**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/scheduled-task-scheduler.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/api/src/modules/scheduled-tasks/scheduled-task-scheduler.ts apps/api/src/modules/scheduled-tasks/scheduled-task-scheduler.test.ts
git commit -m "feat(api): run scheduled agent tasks"
```

---

### Task 5: Service And Router

**Files:**
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-service.ts`
- Create: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-router.ts`
- Modify: `apps/api/src/modules/scheduled-tasks/index.ts`
- Modify: `apps/api/src/router/v1/index.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-service.test.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-router.test.ts`

- [ ] **Step 1: Write failing service tests**

Create service tests for:

- valid create stores `nextRunAt`, defaults `enabled` to true when omitted, and calls `scheduler.reloadTask(id)`.
- invalid cron throws `Invalid cron expression`.
- empty name, prompt, provider, modelId, workspacePath, or timezone throws a validation error.
- invalid thinking level throws a validation error.
- update recalculates `nextRunAt` when cron or timezone changes.
- enable and disable update `enabled` and reload the scheduler.
- delete removes the row and reloads the scheduler for that id.

- [ ] **Step 2: Write failing router tests**

Create route tests for:

```txt
GET    /scheduled-tasks
POST   /scheduled-tasks
GET    /scheduled-tasks/:id
PATCH  /scheduled-tasks/:id
DELETE /scheduled-tasks/:id
POST   /scheduled-tasks/:id/enable
POST   /scheduled-tasks/:id/disable
```

Assert bad create requests return 400 and missing ids return 404.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/scheduled-tasks-service.test.ts src/modules/scheduled-tasks/scheduled-tasks-router.test.ts
```

Expected: FAIL because service and router do not exist.

- [ ] **Step 4: Implement service**

Export:

```ts
export interface ScheduledTasksService {
  createScheduledTask: (input: ScheduledAgentTaskInput) => ScheduledAgentTaskRow;
  deleteScheduledTask: (id: string) => boolean;
  disableScheduledTask: (id: string) => ScheduledAgentTaskRow | undefined;
  enableScheduledTask: (id: string) => ScheduledAgentTaskRow | undefined;
  findScheduledTask: (id: string) => ScheduledAgentTaskRow | undefined;
  listScheduledTasks: () => ScheduledAgentTaskRow[];
  updateScheduledTask: (
    id: string,
    input: Partial<ScheduledAgentTaskInput>
  ) => ScheduledAgentTaskRow | undefined;
}
```

Validate all string fields with `.trim().length > 0`, validate cron with `isValidCronExpression`, and calculate `nextRunAt` with `getNextRunAt`.

- [ ] **Step 5: Implement router**

Parse request bodies without accepting unknown types. Body shape:

```ts
{
  allowConcurrentRuns?: boolean;
  cronExpression?: string;
  enabled?: boolean;
  modelId?: string;
  name?: string;
  prompt?: string;
  provider?: string;
  thinkingLevel?: unknown;
  timezone?: string;
  workspacePath?: string;
}
```

Use `sendSuccess` and `sendError` like existing routers. Do not add `run-now` or `runs` routes.

- [ ] **Step 6: Mount router**

In `apps/api/src/router/v1/index.ts`, extend `CreateV1RouterOptions`, import `createScheduledTasksRouter`, and mount:

```ts
router.use(createScheduledTasksRouter(options));
```

- [ ] **Step 7: Verify tests pass**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/scheduled-tasks-service.test.ts src/modules/scheduled-tasks/scheduled-tasks-router.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/api/src/modules/scheduled-tasks apps/api/src/router/v1/index.ts
git commit -m "feat(api): expose scheduled task endpoints"
```

---

### Task 6: Default Service Wiring And Startup Registration

**Files:**
- Modify: `apps/api/src/modules/scheduled-tasks/index.ts`
- Modify: `apps/api/src/runtime.ts`
- Test: `apps/api/src/modules/scheduled-tasks/scheduled-tasks-service.test.ts`
- Test: `apps/api/src/runtime.test.ts`

- [ ] **Step 1: Write failing default wiring tests**

Add coverage that default scheduled task service construction uses the SQLite database, the default agents service, and exposes a `start()` method that calls scheduler `start()`. If `runtime.test.ts` already mocks startup dependencies, add an assertion that server startup initializes the scheduled service after agents service creation.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/scheduled-tasks-service.test.ts src/runtime.test.ts
```

Expected: FAIL because there is no default scheduled task service or startup call.

- [ ] **Step 3: Add default service factory**

In `apps/api/src/modules/scheduled-tasks/index.ts`, export:

```ts
export function getDefaultScheduledTasksService(options: {
  agentsService: AgentsService;
}): ScheduledTasksService & { start: () => void; stop: () => void };
```

Create the same database path used by the agents default service, run migrations, create `createSqliteWorkspaceRepository(database)`, `createSqliteScheduledTasksRepository(database)`, and a scheduler with the injected `agentsService`.

- [ ] **Step 4: Start scheduler during server startup**

In `apps/api/src/runtime.ts`, change:

```ts
getDefaultAgentsService();
```

to:

```ts
const agentsService = getDefaultAgentsService();
getDefaultScheduledTasksService({ agentsService }).start();
```

- [ ] **Step 5: Verify startup tests pass**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks/scheduled-tasks-service.test.ts src/runtime.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/api/src/modules/scheduled-tasks/index.ts apps/api/src/runtime.ts apps/api/src/modules/scheduled-tasks/scheduled-tasks-service.test.ts apps/api/src/runtime.test.ts
git commit -m "feat(api): register scheduled tasks on startup"
```

---

### Task 7: Final Verification

**Files:**
- Review all changed files.

- [ ] **Step 1: Run scheduled task test suite**

Run:

```bash
corepack pnpm --filter @hold-rein/api exec vitest run src/modules/scheduled-tasks src/modules/agents/service/index.test.ts src/modules/workspaces/workspace-repository.test.ts src/db/database.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run API typecheck**

Run: `corepack pnpm --filter @hold-rein/api typecheck`

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `corepack pnpm test`

Expected: PASS.

- [ ] **Step 4: Check file lengths**

Run:

```bash
wc -l apps/api/src/modules/scheduled-tasks/*.ts apps/api/src/modules/agents/service/index.ts apps/api/src/modules/workspaces/workspace-repository.ts apps/api/src/db/schema.ts apps/api/src/db/migrate.ts
```

Expected: every file is at or below 500 lines. If a file exceeds 500 lines, split it into a folder and export the public API through `index.ts`.

- [ ] **Step 5: Review diff**

Run: `git diff --stat && git diff --check`

Expected: no whitespace errors and no unrelated changes.

- [ ] **Step 6: Commit final fixes if needed**

If verification required small fixes, run:

```bash
git add <changed-files>
git commit -m "test(api): verify scheduled agent tasks"
```

---

### Self-Review

- Spec coverage: The plan covers persisted scheduled task configuration, `sourceType/sourceMark`, `run_all` execution, startup scanning/registration, node-cron scheduling, cron-parser next-run calculation, concurrency skipping, and the reduced API surface without run history routes.
- Placeholder scan: No TBD/TODO placeholders remain; each task names concrete files, behavior, commands, and expected outcomes.
- Type consistency: The plan consistently uses `sourceType/sourceMark` in database rows and `source: { type, mark }` in `StartAgentInput`.
