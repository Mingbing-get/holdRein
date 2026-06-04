// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./config/env", () => ({
  getAppEnv: () => ({
    apiBaseUrl: "http://localhost:4000"
  })
}));

import App from "./App";

const fetchMock = vi.fn<typeof fetch>();

describe("App", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("renders the workspace shell with top bar actions", () => {
    render(<App />);
    const sidebar = screen.getByLabelText("Workspace sidebar");
    const topBar = screen.getByTestId("workspace-top-bar");

    expect(within(sidebar).getByText("Engineering Hub")).toBeInTheDocument();
    expect(within(topBar).queryByText("Engineering Hub")).not.toBeInTheDocument();
    expect(
      within(topBar).getByRole("button", { name: "Collapse sidebar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Model configuration" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open settings" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Toggle theme" })
    ).toBeInTheDocument();
    expect(topBar).toHaveStyle({ padding: "8px 16px" });
    expect(document.body).toHaveStyle({
      background: "var(--app-color-bg-base)"
    });
  });

  it("switches the main area to model configuration and renders custom providers first", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: [
          { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" },
          { hasApiKey: true, id: "acme-ai", modelCount: 3, source: "custom" }
        ],
        msg: "success"
      }),
      ok: true
    } as Response);

    render(<App />);

    expect(screen.getByTestId("chat-workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Model configuration" }));

    expect(await screen.findByText("模型配置")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/model-providers"
    );

    const providerCards = await screen.findAllByTestId("model-provider-card");

    expect(providerCards).toHaveLength(2);
    expect(within(providerCards[0] as HTMLElement).getByText("acme-ai")).toBeVisible();
    expect(within(providerCards[1] as HTMLElement).getByText("openai")).toBeVisible();
    expect(screen.getByText("自定义")).toBeInTheDocument();
    expect(screen.getByText("内置")).toBeInTheDocument();
    expect(screen.getByText("模型数量 3")).toBeInTheDocument();
    expect(screen.getByText("已配置 API Key")).toBeInTheDocument();
    expect(screen.getByText("未配置 API Key")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-workspace")).not.toBeInTheDocument();
  });

  it("opens the api key dialog for an unconfigured provider and stores the key", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            hasApiKey: true,
            provider: "openai"
          },
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Model configuration" }));

    expect(await screen.findByText("未配置 API Key")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit API key for openai" })
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-test-123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /提\s*交/ }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/model-providers/openai/api-key",
      {
        body: JSON.stringify({ apiKey: "sk-test-123" }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PUT"
      }
    );
    expect(await screen.findByText("已配置 API Key")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit API key for openai" })
    ).toBeInTheDocument();
  });

  it("allows editing an already configured api key without pre-filling the current value", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            { hasApiKey: true, id: "openai", modelCount: 12, source: "builtin" }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            hasApiKey: true,
            provider: "openai"
          },
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Model configuration" }));

    expect(await screen.findByText("已配置 API Key")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit API key for openai" })
    );

    const apiKeyInput = await screen.findByLabelText("API Key");

    expect(apiKeyInput).toHaveValue("");
    expect(screen.getByRole("button", { name: /取\s*消/ })).toBeInTheDocument();

    fireEvent.change(apiKeyInput, {
      target: { value: "sk-updated-456" }
    });
    fireEvent.click(screen.getByRole("button", { name: /提\s*交/ }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/model-providers/openai/api-key",
      {
        body: JSON.stringify({ apiKey: "sk-updated-456" }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PUT"
      }
    );
    expect(await screen.findByText("已配置 API Key")).toBeInTheDocument();
  });

  it("toggles the app theme from light to dark", () => {
    render(<App />);

    expect(document.documentElement.dataset.themeMode).toBe("light");

    fireEvent.click(screen.getByRole("switch", { name: "Toggle theme" }));

    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(screen.getByRole("switch", { name: "Toggle theme" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("shows tooltips for model configuration and settings actions", async () => {
    render(<App />);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Model configuration" })
    );
    expect(await screen.findByText("模型配置")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Open settings" }));
    expect(await screen.findByText("设置")).toBeInTheDocument();
  });

  it("collapses the workspace sidebar", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    expect(within(sidebar).getByText("Engineering Hub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(
      screen.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();
    expect(sidebar).not.toBeVisible();
    expect(within(sidebar).queryByText("Engineering Hub")).not.toBeInTheDocument();
  });

  it("renders workspace groups and conversations with aligned navigation styling", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    const newConversationButton = within(sidebar).getByRole("button", {
      name: "开启新对话"
    });
    const engineeringGroup = within(sidebar).getByTestId(
      "workspace-group-workspace-engineering"
    );
    const activeConversation = within(sidebar).getByTestId(
      "workspace-conversation-conv-ops-sync"
    );
    const inactiveConversation = within(sidebar).getByTestId(
      "workspace-conversation-conv-release-audit"
    );

    expect(
      within(engineeringGroup).getByTestId("workspace-folder-open-icon")
    ).toBeInTheDocument();
    expect(newConversationButton).toHaveStyle({
      borderRadius: "6px",
      justifyContent: "flex-start",
      width: "100%"
    });
    expect(engineeringGroup.parentElement).toHaveStyle({ gap: "2px" });
    expect(activeConversation).toHaveStyle({
      borderRadius: "6px",
      fontWeight: "400",
      paddingLeft: "20px"
    });
    expect(activeConversation.style.background).not.toBe("");

    fireEvent.mouseEnter(inactiveConversation);

    expect(inactiveConversation).toHaveStyle({
      borderRadius: "6px",
      paddingLeft: "20px"
    });
    expect(inactiveConversation.style.background).not.toBe("");
  });

  it("resizes the workspace sidebar from its right border within bounds", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    const workspaceLayout = screen.getByTestId("workspace-main-layout");
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize workspace sidebar"
    });

    expect(sidebar).toHaveStyle({ width: "240px" });
    expect(resizeHandle).toHaveStyle({ cursor: "col-resize" });

    fireEvent.mouseEnter(resizeHandle);

    expect(sidebar.style.borderRight).toBe(
      "1px solid var(--app-color-primary)"
    );

    fireEvent.mouseDown(resizeHandle, { clientX: 240 });

    expect(sidebar).toHaveStyle({ transition: "transform 0.2s ease" });
    expect(workspaceLayout).toHaveStyle({ transition: "none" });

    fireEvent.mouseMove(document, { clientX: 800 });
    fireEvent.mouseUp(document);

    expect(sidebar).toHaveStyle({ width: "680px" });

    fireEvent.mouseDown(resizeHandle, { clientX: 680 });
    fireEvent.mouseMove(document, { clientX: 0 });
    fireEvent.mouseUp(document);

    expect(sidebar).toHaveStyle({ width: "120px" });
  });
});
