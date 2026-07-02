// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../app/app-ui-context";
import { AppWorkspaceProvider } from "../../app/app-workspace-context";
import type { SelectedModel } from "../chat/model-selector";
import { ScheduledTasksView } from "./scheduled-tasks-view";

vi.mock("../chat/model-selector", () => ({
  ModelSelector: ({
    onChange,
    value
  }: {
    onChange?: (value: SelectedModel) => void;
    value?: SelectedModel;
  }) => (
    <button
      data-model-id={value?.modelId ?? ""}
      data-provider-id={value?.providerId ?? ""}
      onClick={() =>
        onChange?.({
          modelId: "gpt-4.1",
          providerId: "openai",
          reasoning: false
        })
      }
      type="button"
    >
      选择模型
    </button>
  )
}));

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

function createMatchMediaMock(): typeof window.matchMedia {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined
  })) as typeof window.matchMedia;
}

const fetchMock = vi.fn<typeof fetch>();

describe("ScheduledTasksView", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads scheduled tasks with a workspace filter and toggles enabled state after confirmation", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: [createTaskFixture()], msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: createTaskFixture({ enabled: false }),
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [createTaskFixture({ enabled: false })],
          msg: "ok"
        }),
        ok: true
      } as Response);

    renderScheduledTasksView({ workspacePath: "/workspace" });

    expect(await screen.findByText("Every five minutes")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/scheduled-tasks?workspacePath=%2Fworkspace"
    );
    fireEvent.click(screen.getByRole("button", { name: "禁用 Every five minutes" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认禁用" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/scheduled-tasks/scheduled-1/disable",
        { method: "POST" }
      );
    });
  });

  it("creates tasks with the locked workspace path and the user's timezone", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: [], msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: createTaskFixture(), msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: [createTaskFixture()], msg: "ok" }),
        ok: true
      } as Response);

    renderScheduledTasksView({ workspacePath: "/workspace" });

    fireEvent.click(await screen.findByRole("button", { name: "新增定时任务" }));
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "Every five minutes" }
    });
    fireEvent.change(screen.getByLabelText("任务提示词"), {
      target: { value: "Run scheduled check" }
    });
    fireEvent.change(screen.getByLabelText("Cron 表达式"), {
      target: { value: "*/5 * * * *" }
    });
    fireEvent.click(screen.getByRole("button", { name: "选择模型" }));
    expect(screen.getByLabelText("Workspace Path")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "保存定时任务" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/scheduled-tasks",
        expect.objectContaining({
          body: expect.stringContaining('"workspacePath":"/workspace"'),
          method: "POST"
        })
      );
    });
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/api/v1/scheduled-tasks") &&
        init?.method === "POST"
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as {
      timezone?: string;
    };
    expect(body.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

function renderScheduledTasksView({
  workspacePath
}: {
  workspacePath?: string;
} = {}) {
  return render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <ScheduledTasksView
          apiBaseUrl="http://localhost:4000"
          {...(workspacePath === undefined ? {} : { workspacePath })}
        />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function createTaskFixture(
  input: Partial<ReturnType<typeof createTaskInput> & { enabled: boolean }> = {}
) {
  return {
    ...createTaskInput(),
    createdAt: "2026-07-02T00:00:00.000Z",
    enabled: true,
    id: "scheduled-1",
    lastRunAt: null,
    nextRunAt: "2026-07-02T00:05:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    ...input
  };
}

function createTaskInput() {
  return {
    allowConcurrentRuns: false,
    cronExpression: "*/5 * * * *",
    modelId: "gpt-4.1",
    name: "Every five minutes",
    prompt: "Run scheduled check",
    provider: "openai",
    thinkingLevel: "medium" as const,
    timezone: "Asia/Shanghai",
    workspacePath: "/workspace"
  };
}
