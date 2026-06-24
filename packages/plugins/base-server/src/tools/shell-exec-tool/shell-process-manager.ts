import { randomUUID } from "node:crypto";

const MAX_STREAM_LENGTH = 200_000;

export type ShellProcessStatus = "running" | "completed" | "failed" | "killed";

export interface ShellProcessRecord {
  readonly command: string;
  readonly cwd: string;
  readonly endedAt?: string;
  readonly exitCode?: number;
  readonly id: string;
  readonly startedAt: string;
  readonly status: ShellProcessStatus;
  readonly stderr: string;
  readonly stdout: string;
  readonly taskId?: string;
  readonly toolCallId: string;
  readonly truncated: boolean;
}

interface MutableShellProcessRecord {
  command: string;
  controller: AbortController;
  cwd: string;
  endedAt?: string;
  exitCode?: number;
  id: string;
  startedAt: string;
  status: ShellProcessStatus;
  stderr: string;
  stdout: string;
  taskId?: string;
  toolCallId: string;
  truncated: boolean;
}

export interface RegisterShellProcessInput {
  readonly command: string;
  readonly controller: AbortController;
  readonly cwd: string;
  readonly taskId?: string;
  readonly toolCallId: string;
}

export class ShellProcessManager {
  private readonly records = new Map<string, MutableShellProcessRecord>();

  appendStderr(id: string, chunk: string): void {
    const record = this.records.get(id);

    if (!record) {
      return;
    }

    const next = appendBounded(record.stderr, chunk);
    record.stderr = next.value;
    record.truncated ||= next.truncated;
  }

  appendStdout(id: string, chunk: string): void {
    const record = this.records.get(id);

    if (!record) {
      return;
    }

    const next = appendBounded(record.stdout, chunk);
    record.stdout = next.value;
    record.truncated ||= next.truncated;
  }

  clear(): void {
    this.records.clear();
  }

  complete(id: string, exitCode: number): void {
    const record = this.records.get(id);

    if (!record || record.status === "killed") {
      return;
    }

    record.endedAt = new Date().toISOString();
    record.exitCode = exitCode;
    record.status = exitCode === 0 ? "completed" : "failed";
  }

  fail(id: string): void {
    const record = this.records.get(id);

    if (!record || record.status === "killed") {
      return;
    }

    record.endedAt = new Date().toISOString();
    record.status = "failed";
  }

  get(id: string): ShellProcessRecord | undefined {
    const record = this.records.get(id);

    return record ? toShellProcessRecord(record) : undefined;
  }

  kill(id: string): ShellProcessRecord | undefined {
    const record = this.records.get(id);

    if (!record) {
      return undefined;
    }

    if (record.status === "running") {
      record.controller.abort();
      record.endedAt = new Date().toISOString();
      record.status = "killed";
    }

    return toShellProcessRecord(record);
  }

  killByTask(taskId: string): ShellProcessRecord[] {
    return this.list(taskId)
      .filter((record) => record.status === "running")
      .map((record) => this.kill(record.id))
      .filter((record): record is ShellProcessRecord => record !== undefined);
  }

  killAndRemoveByTask(taskId: string): ShellProcessRecord[] {
    const taskRecords = this.list(taskId);

    return taskRecords
      .map((record) => {
        const killedRecord = this.kill(record.id) ?? record;
        this.records.delete(record.id);
        return killedRecord;
      });
  }

  list(taskId?: string): ShellProcessRecord[] {
    return Array.from(this.records.values())
      .filter((record) => taskId === undefined || record.taskId === taskId)
      .map(toShellProcessRecord);
  }

  register(input: RegisterShellProcessInput): ShellProcessRecord {
    const id = `shell_${randomUUID()}`;
    const record: MutableShellProcessRecord = {
      command: input.command,
      controller: input.controller,
      cwd: input.cwd,
      id,
      startedAt: new Date().toISOString(),
      status: "running",
      stderr: "",
      stdout: "",
      ...(input.taskId ? { taskId: input.taskId } : {}),
      toolCallId: input.toolCallId,
      truncated: false
    };

    this.records.set(id, record);

    return toShellProcessRecord(record);
  }
}

export const shellProcessManager = new ShellProcessManager();

function appendBounded(current: string, chunk: string): {
  truncated: boolean;
  value: string;
} {
  const value = `${current}${chunk}`;

  if (value.length <= MAX_STREAM_LENGTH) {
    return { truncated: false, value };
  }

  return {
    truncated: true,
    value: value.slice(value.length - MAX_STREAM_LENGTH)
  };
}

function toShellProcessRecord(
  record: MutableShellProcessRecord
): ShellProcessRecord {
  return {
    command: record.command,
    cwd: record.cwd,
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    ...(record.exitCode === undefined ? {} : { exitCode: record.exitCode }),
    id: record.id,
    startedAt: record.startedAt,
    status: record.status,
    stderr: record.stderr,
    stdout: record.stdout,
    ...(record.taskId ? { taskId: record.taskId } : {}),
    toolCallId: record.toolCallId,
    truncated: record.truncated
  };
}
