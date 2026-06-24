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

  it("does not fetch shell processes without a task id", () => {
    const request = vi.fn();

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "idle"
      })
    );

    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText("No task selected")).toBeInTheDocument();
  });

  it("loads shell processes for the active task", async () => {
    const request = vi.fn().mockResolvedValue({
      code: 0,
      data: [
        {
          command: "npm run dev",
          cwd: "/workspace",
          id: "shell-1",
          startedAt: "2026-06-24T00:00:00.000Z",
          status: "running",
          stderr: "",
          stdout: "ready\n",
          taskId: "task-1",
          toolCallId: "tool-call-1",
          truncated: false
        }
      ],
      msg: "ok"
    });

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "running",
        taskId: "task-1"
      })
    );

    await screen.findByText("npm run dev");
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith({
      path: "/plugin/__base/shells",
      query: { taskId: "task-1" }
    });
  });

  it("collapses shell process details by default and toggles them from the title", async () => {
    const request = vi.fn().mockResolvedValue({
      code: 0,
      data: [
        {
          command: "npm run dev",
          cwd: "/workspace",
          id: "shell-1",
          startedAt: "2026-06-24T00:00:00.000Z",
          status: "completed",
          stderr: "",
          stdout: "ready\n",
          taskId: "task-1",
          toolCallId: "tool-call-1",
          truncated: false
        }
      ],
      msg: "ok"
    });

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "idle",
        taskId: "task-1"
      })
    );

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

  it("stops a running shell and refreshes the list", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        data: [
          {
            command: "npm run dev",
            cwd: "/workspace",
            id: "shell-1",
            startedAt: "2026-06-24T00:00:00.000Z",
            status: "running",
            stderr: "",
            stdout: "",
            taskId: "task-1",
            toolCallId: "tool-call-1",
            truncated: false
          }
        ],
        msg: "ok"
      })
      .mockResolvedValueOnce({
        code: 0,
        data: { id: "shell-1", status: "killed" },
        msg: "ok"
      })
      .mockResolvedValueOnce({
        code: 0,
        data: [],
        msg: "ok"
      });

    render(
      React.createElement(ShellProcessesPanel, {
        request,
        status: "running",
        taskId: "task-1"
      })
    );

    fireEvent.click(await screen.findByRole("button", { name: "Stop shell" }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: "POST",
        path: "/plugin/__base/shells/shell-1/kill"
      });
    });
    expect(request).toHaveBeenCalledTimes(3);
  });
});
