// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../app/app-ui-context";
import { AppWorkspaceProvider } from "../../app/app-workspace-context";
import type { SelectedModel } from "../chat/model-selector";
import { ScheduledTasksView } from "./scheduled-tasks-view";

vi.mock("../chat/model-selector", () => ({
  ModelSelector: ({
    className,
    onChange,
    style,
    value
  }: {
    className?: string;
    onChange?: (value: SelectedModel) => void;
    style?: React.CSSProperties;
    value?: SelectedModel;
  }) => (
    <button
      className={className}
      data-model-id={value?.modelId ?? ""}
      data-provider-id={value?.providerId ?? ""}
      onClick={() =>
        onChange?.({
          modelId: "gpt-4.1",
          providerId: "openai",
          reasoning: false
        })
      }
      style={style}
      type="button"
    >
      选择模型
    </button>
  )
}));

vi.mock("../chat/workspace-selector", () => ({
  WorkspaceSelector: ({
    ariaLabel,
    className,
    disabled,
    style,
    value
  }: {
    ariaLabel?: string;
    className?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
    value?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      readOnly
      style={style}
      value={value ?? "/workspace"}
    />
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
    fireEvent.click(
      screen.getByRole("switch", { name: "禁用 Every five minutes" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/scheduled-tasks/scheduled-1/disable",
        { method: "POST" }
      );
    });
  });

  it("uses task-scoped theme classes without rendering a scheduled task subtitle", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ code: 0, data: [createTaskFixture()], msg: "ok" }),
      ok: true
    } as Response);

    const { container } = renderScheduledTasksView({ workspacePath: "/workspace" });

    expect(await screen.findByText("Every five minutes")).toBeVisible();
    expect(screen.queryByText("Workspace: /workspace")).not.toBeInTheDocument();
    expect(container.querySelector(".scheduled-tasks-table")).toBeInTheDocument();
  });

  it("keeps fixed table columns opaque while horizontally scrolling", () => {
    const cssSource = readFileSync(
      resolve(
        process.cwd(),
        "apps/web/src/modules/scheduled-tasks/scheduled-tasks-view.css"
      ),
      "utf8"
    );
    const themeSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/theme.css"),
      "utf8"
    );

    expect(cssSource).toContain(
      ".scheduled-tasks-table .ant-table-cell-fix-left,"
    );
    expect(cssSource).toContain(
      ".scheduled-tasks-table .ant-table-cell-row-hover"
    );
    expect(cssSource).toContain(
      ".scheduled-tasks-table .ant-table-thead .ant-table-cell-fix-left"
    );
    expect(cssSource).toContain(
      "background-color: var(--app-color-bg-container);"
    );
    expect(cssSource).toContain(
      "background-color: var(--app-color-scheduled-table-header-bg);"
    );
    expect(cssSource).toContain(
      "background-color: var(--app-color-scheduled-table-row-hover-bg);"
    );
    expect(cssSource).not.toContain("var(--app-color-fill-secondary)");
    expect(cssSource).not.toContain("var(--app-color-fill-tertiary)");
    expect(cssSource).not.toContain("background: inherit;");
    expect(themeSource).toMatch(
      /--app-color-scheduled-table-header-bg:\s*#[0-9a-f]{6};/i
    );
    expect(themeSource).toMatch(
      /--app-color-scheduled-table-row-hover-bg:\s*#[0-9a-f]{6};/i
    );
  });

  it("renders the enabled control in the fixed status column before actions", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ code: 0, data: [createTaskFixture()], msg: "ok" }),
      ok: true
    } as Response);

    const { container } = renderScheduledTasksView({ workspacePath: "/workspace" });

    expect(await screen.findByText("Every five minutes")).toBeVisible();
    const switchElement = screen.getByRole("switch", {
      name: "禁用 Every five minutes"
    });
    const columnHeaders = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    const cells = screen.getAllByRole("cell");
    const statusCell = cells[cells.length - 2];
    const actionCell = cells[cells.length - 1];

    expect(columnHeaders.slice(-2)).toEqual(["状态", "操作"]);
    expect(statusCell).toBeDefined();
    expect(actionCell).toBeDefined();
    expect(switchElement).toBeChecked();
    expect(within(statusCell as HTMLElement).getByRole("switch")).toBe(
      switchElement
    );
    expect(within(actionCell as HTMLElement).queryByRole("switch")).not.toBeInTheDocument();
    expect(container.querySelector(".ant-switch-small")).toBeInTheDocument();
    expect(screen.queryByText("启用")).not.toBeInTheDocument();
  });

  it("keeps scheduled task model and workspace selectors aligned with form inputs", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ code: 0, data: [], msg: "ok" }),
      ok: true
    } as Response);

    renderScheduledTasksView({ workspacePath: "/workspace" });

    fireEvent.click(await screen.findByRole("button", { name: "新增定时任务" }));

    expect(screen.getByRole("button", { name: "选择模型" })).toHaveClass(
      "scheduled-task-form-control"
    );
    expect(screen.getByLabelText("Workspace Path")).toHaveClass(
      "scheduled-task-form-control"
    );
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
