// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../app/app-workspace-context";
import { ChatWorkspace } from "./chat-workspace";
import type { SelectedModel } from "./model-selector";

vi.mock("./sender", () => ({
  default: ({
    disabled,
    footer
  }: {
    disabled?: boolean;
    footer?: React.ReactNode;
  }) => (
    <div>
      <button data-testid="sender" disabled={disabled}>
        Sender
      </button>
      {footer}
    </div>
  )
}));

vi.mock("./workspace-selector", () => ({
  WorkspaceSelector: () => <div data-testid="workspace-selector" />
}));

vi.mock("./model-selector", () => ({
  ModelSelector: ({
    onChange,
    value
  }: {
    onChange?: (value: SelectedModel) => void;
    value?: SelectedModel;
  }) => (
    <button
      data-testid="model-selector"
      data-model-id={value?.modelId ?? ""}
      data-provider-id={value?.providerId ?? ""}
      onClick={() => {
        onChange?.({
          modelId: "claude-3-5-sonnet",
          providerId: "anthropic"
        });
      }}
    >
      Model selector
    </button>
  )
}));

describe("ChatWorkspace", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables the sender until both a workspace and model are selected", () => {
    renderChatWorkspace();

    expect(screen.getByTestId("sender")).toBeDisabled();
  });

  it("enables the sender when a workspace and model are selected", () => {
    renderChatWorkspace({
      activeAgent: {
        modelId: "claude-3-5-sonnet",
        providerId: "anthropic"
      },
      activeWorkspaceId: "workspace-one"
    });

    expect(screen.getByTestId("sender")).toBeEnabled();
  });

  it("stores selected models in the workspace context", () => {
    renderChatWorkspace({
      activeWorkspaceId: "workspace-one"
    });

    fireEvent.click(screen.getByTestId("model-selector"));

    expect(screen.getByTestId("sender")).toBeEnabled();
    expect(screen.getByTestId("model-selector")).toHaveAttribute(
      "data-provider-id",
      "anthropic"
    );
    expect(screen.getByTestId("model-selector")).toHaveAttribute(
      "data-model-id",
      "claude-3-5-sonnet"
    );
  });
});

interface RenderOptions {
  activeAgent?: SelectedModel;
  activeWorkspaceId?: string;
}

function renderChatWorkspace(options: RenderOptions = {}) {
  render(
    <AppWorkspaceProvider>
      <WorkspaceStateSetup {...options} />
      <ChatWorkspace activeTaskName="Task One" apiBaseUrl="http://localhost:4000" />
    </AppWorkspaceProvider>
  );
}

function WorkspaceStateSetup({
  activeAgent,
  activeWorkspaceId
}: RenderOptions) {
  const {
    setActiveAgent,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace One",
        path: "/Users/mingbing/apps/workspace-one",
        tasks: []
      }
    ]);

    if (activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspaceId);
    }

    if (activeAgent) {
      setActiveAgent(activeAgent);
    }
  }, [
    activeAgent,
    activeWorkspaceId,
    setActiveAgent,
    setActiveWorkspaceId,
    setWorkspaces
  ]);

  return null;
}
