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

import { SkillManagementView } from "./skill-management-view";

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

describe("SkillManagementView", () => {
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

  it("renders installed skills and toggles disabled state", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            skills: [
              {
                disabled: false,
                id: "planning",
                name: "planning",
                path: "/skills/planning"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            disabled: true,
            id: "planning",
            name: "planning",
            path: "/skills/planning"
          },
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(<SkillManagementView apiBaseUrl="http://localhost:4000" />);

    const card = await screen.findByTestId("skill-card-planning");

    expect(within(card).getByText("planning")).toBeVisible();
    fireEvent.click(within(card).getByRole("switch", { name: "禁用 planning" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/skills/planning",
        {
          body: JSON.stringify({ disabled: true }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
    });
  });

  it("installs a skill from a github repository", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { skills: [] }, msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { disabled: false, id: "review-helper", name: "review-helper" },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            skills: [
              { disabled: false, id: "review-helper", name: "review-helper" }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(<SkillManagementView apiBaseUrl="http://localhost:4000" />);

    fireEvent.click(await screen.findByRole("button", { name: "安装技能" }));
    fireEvent.change(screen.getByLabelText("GitHub 仓库地址"), {
      target: { value: "https://github.com/acme/review-helper.git" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认安装技能" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/skills/install",
        {
          body: JSON.stringify({
            repositoryUrl: "https://github.com/acme/review-helper.git"
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
    });
    expect(await screen.findByText("review-helper")).toBeInTheDocument();
  });

  it.each([
    "https://github.com/acme/skills/tree/main/tools/review-helper",
    "https://github.com/acme/skills/blob/main/tools/review-helper/SKILL.md"
  ])("installs a skill from a github web URL: %s", async (repositoryUrl) => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { skills: [] }, msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { disabled: false, id: "review-helper", name: "review-helper" },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { skills: [] }, msg: "ok" }),
        ok: true
      } as Response);

    render(<SkillManagementView apiBaseUrl="http://localhost:4000" />);

    fireEvent.click(await screen.findByRole("button", { name: "安装技能" }));
    fireEvent.change(screen.getByLabelText("GitHub 仓库地址"), {
      target: { value: repositoryUrl }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认安装技能" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/skills/install",
        {
          body: JSON.stringify({ repositoryUrl }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
    });
  });
});
