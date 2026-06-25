// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createShellProcesses, ShellProcessesPanel } from ".";

describe("createShellProcesses", () => {
  it("returns a shell processes right panel wired with the runtime request", () => {
    const request = vi.fn();
    const panel = createShellProcesses({ request });

    expect(panel.id).toBe("shell-processes");
    expect(panel.title).toBe("Shell commands");
    expect(panel.icon).toBeTruthy();

    render(
      React.createElement(panel.Render, {
        messages: [],
        status: "idle"
      })
    );

    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText("No task selected")).toBeInTheDocument();
  });
});

describe("ShellProcessesPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not listen for shell processes without a task id", () => {
    const request = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "idle"
      })
    );

    expect(request).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("No task selected")).toBeInTheDocument();
  });

  it("listens for shell processes for the active task", async () => {
    const request = vi.fn();
    const stream = createShellStream();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(stream.response);

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "running",
        taskId: "task-1"
      })
    );

    stream.write({
      record: createShellRecord({ stdout: "ready\n" }),
      type: "shell_start"
    });

    await screen.findByText("npm run dev");
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/plugin/__base/shells?taskId=task-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("collapses shell process details by default and toggles them from the title", async () => {
    const request = vi.fn();
    const stream = createShellStream();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(stream.response);

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "idle",
        taskId: "task-1"
      })
    );
    stream.write({
      record: createShellRecord({ status: "completed", stdout: "ready\n" }),
      type: "shell_start"
    });

    const title = await screen.findByRole("button", { name: /npm run dev/ });

    expect(title).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("/workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("ready")).not.toBeInTheDocument();

    fireEvent.click(title);

    expect(title).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("/workspace")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();

    fireEvent.click(title);

    expect(title).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("/workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
  });

  it("streams stdout chunks into an existing shell process", async () => {
    const request = vi.fn();
    const stream = createShellStream();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(stream.response);

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "running",
        taskId: "task-1"
      })
    );
    stream.write({
      record: createShellRecord(),
      type: "shell_start"
    });

    const title = await screen.findByRole("button", { name: /npm run dev/ });
    fireEvent.click(title);
    stream.write({
      chunk: "ready\n",
      record: createShellRecord({ stdout: "ready\n" }),
      type: "shell_stdout"
    });

    expect(await screen.findByText("ready")).toBeInTheDocument();
  });

  it("stops a running shell without refreshing the list", async () => {
    const request = vi.fn().mockResolvedValue({
      code: 0,
      data: { id: "shell-1", status: "killed" },
      msg: "ok"
    });
    const stream = createShellStream();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(stream.response);

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "running",
        taskId: "task-1"
      })
    );
    stream.write({
      record: createShellRecord(),
      type: "shell_start"
    });

    fireEvent.click(await screen.findByRole("button", { name: "Stop shell" }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: "POST",
        path: "/plugin/__base/shells/shell-1/kill"
      });
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the component unmounts", async () => {
    const request = vi.fn();
    const stream = createShellStream();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(stream.response);

    const { unmount } = render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "running",
        taskId: "task-1"
      })
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    const signal = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      ?.signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

function createShellRecord(
  overrides: Partial<ShellProcessRecord> = {}
): ShellProcessRecord {
  return {
    command: "npm run dev",
    cwd: "/workspace",
    id: "shell-1",
    startedAt: "2026-06-24T00:00:00.000Z",
    status: "running",
    stderr: "",
    stdout: "",
    taskId: "task-1",
    toolCallId: "tool-call-1",
    truncated: false,
    ...overrides
  };
}

function createShellStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const response = Promise.resolve(new Response(
    new ReadableStream<Uint8Array>({
      start(nextController) {
        controller = nextController;
      }
    }),
    {
      headers: { "content-type": "application/x-ndjson" },
      status: 200
    }
  ));

  return {
    response,
    write(event: unknown): void {
      controller?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    }
  };
}
