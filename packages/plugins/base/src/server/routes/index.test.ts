import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shellProcessManager } from "../tools/shell-exec-tool/shell-process-manager";
import createRouter from ".";

describe("base plugin shell routes", () => {
  beforeEach(() => {
    shellProcessManager.clear();
  });

  afterEach(() => {
    shellProcessManager.clear();
  });

  it("streams existing shell records and subsequent shell events as jsonl", async () => {
    const existing = shellProcessManager.register({
      command: "npm test",
      controller: new AbortController(),
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });
    shellProcessManager.appendStdout(existing.id, "existing\n");

    const route = findRouteHandler(createRouter({
      RESPONSE_CODE_DEFINITIONS: {} as never,
      sendError: () => undefined,
      sendSuccess: () => undefined
    }), "/shells");
    const request = Object.assign(new EventEmitter(), {
      query: { taskId: "task-1" }
    });
    const response = {
      flushHeaders: vi.fn(),
      headers: new Map<string, string>(),
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn((key: string, value: string) => {
        response.headers.set(key.toLowerCase(), value);
      }),
      write: vi.fn()
    };

    route(request, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(response.flushHeaders).toHaveBeenCalled();

    const firstLines = takeWrittenLines(response.write, 2);
    const next = shellProcessManager.register({
      command: "pnpm build",
      controller: new AbortController(),
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-2"
    });
    shellProcessManager.appendStderr(next.id, "later\n");
    const streamedLines = takeWrittenLines(response.write, 4).slice(2);
    request.emit("close");
    shellProcessManager.appendStdout(next.id, "ignored\n");

    expect(firstLines.map((line) => JSON.parse(line))).toEqual([
      {
        record: expect.objectContaining({ id: existing.id }),
        type: "shell_start"
      },
      {
        chunk: "existing\n",
        record: expect.objectContaining({ id: existing.id }),
        type: "shell_stdout"
      }
    ]);
    expect(streamedLines.map((line) => JSON.parse(line))).toEqual([
      {
        record: expect.objectContaining({ id: next.id }),
        type: "shell_start"
      },
      {
        chunk: "later\n",
        record: expect.objectContaining({ id: next.id }),
        type: "shell_stderr"
      }
    ]);
    expect(response.write).toHaveBeenCalledTimes(4);
  });
});

function findRouteHandler(router: unknown, path: string) {
  const layer = (router as {
    stack: {
      route?: {
        path: string;
        stack: { handle: (request: never, response: never) => void }[];
      };
    }[];
  }).stack.find((item) => item.route?.path === path);

  if (!layer?.route) {
    throw new Error(`Route not found: ${path}`);
  }

  return layer.route.stack[0].handle;
}

function takeWrittenLines(write: ReturnType<typeof vi.fn>, count: number): string[] {
  return write.mock.calls
    .slice(0, count)
    .map(([line]) => String(line).trimEnd());
}
