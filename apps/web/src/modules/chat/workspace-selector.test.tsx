// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceSelector, getWorkspaceLabelFromPath } from "./workspace-selector";

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

describe("getWorkspaceLabelFromPath", () => {
  it("returns the final directory name for a full path", () => {
    expect(getWorkspaceLabelFromPath("/Users/mingbing/apps/holdRein")).toBe(
      "holdRein"
    );
  });

  it("ignores a trailing slash", () => {
    expect(getWorkspaceLabelFromPath("/Users/mingbing/apps/holdRein/")).toBe(
      "holdRein"
    );
  });
});

describe("WorkspaceSelector", () => {
  beforeAll(() => {
    const getComputedStyle = window.getComputedStyle.bind(window);

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
      getComputedStyle(element)
    );
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders placeholder workspace options", async () => {
    render(<WorkspaceSelector apiBaseUrl="" />);

    expect(screen.queryByText("工作空间")).not.toBeInTheDocument();
    expect(screen.queryByTestId("selected-workspace-label")).not.toBeInTheDocument();

    const selectRoot = screen
      .getByRole("combobox", { name: "工作空间" })
      .closest(".ant-select");

    expect(selectRoot).toHaveClass("ant-select-borderless");
    expect(selectRoot).not.toHaveStyle({ minWidth: "180px" });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "工作空间" }));

    expect(
      await screen.findByRole("option", { hidden: true, name: "holdRein" })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("option", { hidden: true, name: "demo-workspace" })
    ).toHaveAttribute("aria-selected", "false");
  });

  it("adds the selected directory as the active option", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          parentPath: "/Users/mingbing/apps",
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "ai-project",
              path: "/Users/mingbing/apps/ai-project"
            }
          ]
        },
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(<WorkspaceSelector apiBaseUrl="" />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "工作空间" }));
    fireEvent.click(await screen.findByRole("button", { name: "选择工作空间" }));

    const row = await screen.findByTestId("file-selector-entry-ai-project");
    fireEvent.click(
      within(row).getByRole("button", { name: "ai-project folder selectable" })
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(screen.getByTitle("ai-project")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "工作空间" }));

    expect(
      await screen.findByRole("option", { hidden: true, name: "ai-project" })
    ).toHaveAttribute("aria-selected", "true");
  });
});
