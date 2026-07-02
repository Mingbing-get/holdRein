// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkspaceSettingResponse } from "../workspace-nav-types";
import { WorkspaceSettingsModal } from "./workspace-settings-modal";

describe("WorkspaceSettingsModal", () => {
  beforeAll(() => {
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
  });

  it("hides plugin and skill selectors when global policies are selected", async () => {
    render(
      <WorkspaceSettingsModal
        isLoading={false}
        isSubmitting={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        open
        setting={createGlobalWorkspaceSetting()}
        workspaceName="Real Workspace"
      />
    );

    expect(await screen.findByText("Workspace 配置")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByLabelText("可用插件")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("可用技能")).not.toBeInTheDocument();
    });
  });
});

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

function createGlobalWorkspaceSetting(): WorkspaceSettingResponse {
  return {
    pluginOptions: [
      { id: "base", name: "Base" },
      { id: "code", name: "Code" }
    ],
    setting: {},
    skillOptions: [
      {
        id: "planner",
        name: "planner",
        path: "/Users/mingbing/.codex/skills/planner",
        source: "workspace"
      },
      {
        id: "reviewer",
        name: "reviewer",
        path: "/Users/mingbing/.codex/skills/reviewer",
        source: "global"
      }
    ],
    workspaceId: "workspace-real"
  };
}
