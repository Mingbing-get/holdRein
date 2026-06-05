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

import { ModelProvidersView } from "./model-providers-view";

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

describe("ModelProvidersView", () => {
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

  it("renders custom providers before built-in providers", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: [
          { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" },
          {
            baseUrl: "https://api.acme.ai/v1",
            hasApiKey: true,
            id: "acme-ai",
            modelCount: 3,
            source: "custom"
          }
        ],
        msg: "success"
      }),
      ok: true
    } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    const providerCards = await screen.findAllByTestId("model-provider-card");

    expect(providerCards).toHaveLength(2);
    expect(within(providerCards[0] as HTMLElement).getByText("acme-ai")).toBeVisible();
    expect(within(providerCards[1] as HTMLElement).getByText("openai")).toBeVisible();
    expect(screen.getByText("自定义")).toBeInTheDocument();
    expect(screen.getByText("内置")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "添加提供商" })
    ).toBeInTheDocument();
  });

  it("keeps the custom provider group visible and shows an empty hint when there are no custom providers", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: [
          { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" }
        ],
        msg: "success"
      }),
      ok: true
    } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("自定义")).toBeInTheDocument();
    expect(screen.getByText("还没有自定义提供商，先添加一个吧。")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "添加提供商" })
    ).toBeInTheDocument();
  });

  it("creates a custom provider from the custom group action", async () => {
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
            baseUrl: "https://api.acme.ai/v1",
            createdAt: "2026-06-04T00:00:00.000Z",
            id: "custom-provider-id",
            provider: "acme-ai",
            updatedAt: "2026-06-04T00:00:00.000Z"
          },
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              baseUrl: "https://api.acme.ai/v1",
              hasApiKey: false,
              id: "acme-ai",
              modelCount: 0,
              source: "custom"
            },
            { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" }
          ],
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("还没有自定义提供商，先添加一个吧。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加提供商" }));

    fireEvent.change(await screen.findByLabelText("提供商标识"), {
      target: { value: "acme-ai" }
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.acme.ai/v1" }
    });
    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://localhost:4000/api/v1/model-providers/custom",
        {
          body: JSON.stringify({
            baseUrl: "https://api.acme.ai/v1",
            provider: "acme-ai"
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        }
      );
    });
    expect(await screen.findByText("acme-ai")).toBeInTheDocument();
  });

  it("edits a custom provider from the card action", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              baseUrl: "https://api.acme.ai/v1",
              hasApiKey: true,
              id: "acme-ai",
              modelCount: 3,
              source: "custom"
            },
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
            baseUrl: "https://gateway.acme.ai/v2",
            createdAt: "2026-06-04T00:00:00.000Z",
            id: "custom-provider-id",
            provider: "acme-enterprise",
            updatedAt: "2026-06-04T00:00:01.000Z"
          },
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              baseUrl: "https://gateway.acme.ai/v2",
              hasApiKey: true,
              id: "acme-enterprise",
              modelCount: 3,
              source: "custom"
            },
            { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" }
          ],
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("acme-ai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit provider acme-ai" }));

    expect(await screen.findByLabelText("提供商标识")).toHaveValue("acme-ai");
    expect(screen.getByLabelText("Base URL")).toHaveValue("https://api.acme.ai/v1");

    fireEvent.change(screen.getByLabelText("提供商标识"), {
      target: { value: "acme-enterprise" }
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://gateway.acme.ai/v2" }
    });
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://localhost:4000/api/v1/model-providers/custom/acme-ai",
        {
          body: JSON.stringify({
            baseUrl: "https://gateway.acme.ai/v2",
            provider: "acme-enterprise"
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "PUT"
        }
      );
    });
    expect(await screen.findByText("acme-enterprise")).toBeInTheDocument();
  });

  it("deletes a custom provider after confirmation", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              baseUrl: "https://api.acme.ai/v1",
              hasApiKey: true,
              id: "acme-ai",
              modelCount: 3,
              source: "custom"
            },
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
            provider: "acme-ai"
          },
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            { hasApiKey: false, id: "openai", modelCount: 12, source: "builtin" }
          ],
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("acme-ai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete provider acme-ai" }));
    fireEvent.click(await screen.findByRole("button", { name: /删\s*除/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://localhost:4000/api/v1/model-providers/custom/acme-ai",
        {
          method: "DELETE"
        }
      );
    });
    expect(await screen.findByText("还没有自定义提供商，先添加一个吧。")).toBeInTheDocument();
  });

  it("stores an API key for a provider", async () => {
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

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("未配置 API Key")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit API key for openai" })
    );

    fireEvent.change(await screen.findByLabelText("API Key"), {
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
  });

  it("allows editing an already configured API key without pre-filling the current value", async () => {
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

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("已配置 API Key")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit API key for openai" })
    );

    const apiKeyInput = await screen.findByLabelText("API Key");

    expect(apiKeyInput).toHaveValue("");

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

  it("opens a model dialog for built-in providers", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            { hasApiKey: false, id: "openai", modelCount: 2, source: "builtin" }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "openai-responses",
              contextWindow: 200000,
              id: "gpt-5",
              input: ["text", "image"],
              maxTokens: 8192,
              name: "GPT-5",
              provider: "openai",
              reasoning: true
            },
            {
              api: "openai-responses",
              contextWindow: 128000,
              id: "gpt-4.1",
              input: ["text"],
              maxTokens: 4096,
              name: "GPT-4.1",
              provider: "openai",
              reasoning: false
            }
          ],
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("openai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看 openai 的模型" }));

    expect(await screen.findByText("openai 支持的模型")).toBeInTheDocument();
    expect(await screen.findByText("GPT-5")).toBeInTheDocument();
    expect(screen.getByText("GPT-4.1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/model-providers/openai/models"
    );
  });

  it("supports creating, updating, and deleting custom provider models in the model dialog", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              baseUrl: "https://api.acme.ai/v1",
              hasApiKey: true,
              id: "acme-ai",
              modelCount: 1,
              source: "custom"
            }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "openai-responses",
              contextWindow: 32000,
              id: "acme-chat",
              input: ["text"],
              maxTokens: 4096,
              name: "Acme Chat",
              provider: "acme-ai",
              reasoning: false
            }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            api: "openai-completions",
            contextWindow: 64000,
            id: "acme-vision",
            input: ["text", "image"],
            maxTokens: 8192,
            name: "Acme Vision",
            provider: "acme-ai",
            reasoning: true
          },
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "openai-responses",
              contextWindow: 32000,
              id: "acme-chat",
              input: ["text"],
              maxTokens: 4096,
              name: "Acme Chat",
              provider: "acme-ai",
              reasoning: false
            },
            {
              api: "openai-completions",
              contextWindow: 64000,
              id: "acme-vision",
              input: ["text", "image"],
              maxTokens: 8192,
              name: "Acme Vision",
              provider: "acme-ai",
              reasoning: true
            }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            api: "openai-responses",
            contextWindow: 128000,
            id: "acme-chat",
            input: ["text", "file"],
            maxTokens: 16384,
            name: "Acme Chat Pro",
            provider: "acme-ai",
            reasoning: true
          },
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "openai-responses",
              contextWindow: 128000,
              id: "acme-chat",
              input: ["text", "image"],
              maxTokens: 16384,
              name: "Acme Chat Pro",
              provider: "acme-ai",
              reasoning: true
            },
            {
              api: "openai-completions",
              contextWindow: 64000,
              id: "acme-vision",
              input: ["text", "image"],
              maxTokens: 8192,
              name: "Acme Vision",
              provider: "acme-ai",
              reasoning: true
            }
          ],
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            modelId: "acme-vision",
            provider: "acme-ai"
          },
          msg: "success"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "openai-responses",
              contextWindow: 128000,
              id: "acme-chat",
              input: ["text", "image"],
              maxTokens: 16384,
              name: "Acme Chat Pro",
              provider: "acme-ai",
              reasoning: true
            }
          ],
          msg: "success"
        }),
        ok: true
      } as Response);

    render(<ModelProvidersView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("acme-ai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看 acme-ai 的模型" }));

    expect(await screen.findByText("Acme Chat")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加模型" }));

    fireEvent.change(await screen.findByLabelText("模型 ID"), {
      target: { value: "acme-vision" }
    });
    fireEvent.change(screen.getByLabelText("模型名称"), {
      target: { value: "Acme Vision" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "image" }));
    fireEvent.change(screen.getByLabelText("上下文窗口"), {
      target: { value: "64000" }
    });
    fireEvent.change(screen.getByLabelText("最大输出 Tokens"), {
      target: { value: "8192" }
    });
    fireEvent.click(screen.getByLabelText("支持推理"));
    fireEvent.click(screen.getByRole("button", { name: /创\s*建模型/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "http://localhost:4000/api/v1/model-providers/acme-ai/models",
        {
          body: JSON.stringify({
            api: "openai-responses",
            contextWindow: 64000,
            input: ["text", "image"],
            maxTokens: 8192,
            modelId: "acme-vision",
            name: "Acme Vision",
            reasoning: true
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        }
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑模型 acme-chat" }));

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "API 类型" }));
    expect(
      await screen.findByRole("option", { name: "openai-responses" })
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.change(await screen.findByLabelText("模型名称"), {
      target: { value: "Acme Chat Pro" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "image" }));
    fireEvent.change(screen.getByLabelText("上下文窗口"), {
      target: { value: "128000" }
    });
    fireEvent.change(screen.getByLabelText("最大输出 Tokens"), {
      target: { value: "16384" }
    });
    fireEvent.click(screen.getByLabelText("支持推理"));
    fireEvent.click(screen.getByRole("button", { name: /保存模型/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
        "http://localhost:4000/api/v1/model-providers/acme-ai/models/acme-chat",
        {
          body: JSON.stringify({
            api: "openai-responses",
            contextWindow: 128000,
            input: ["text", "image"],
            maxTokens: 16384,
            name: "Acme Chat Pro",
            reasoning: true
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "PUT"
        }
      );
    });
    expect(await screen.findByText("Acme Chat Pro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除模型 acme-vision" }));
    fireEvent.click((await screen.findAllByRole("button", { name: /删\s*除模型/ })).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        7,
        "http://localhost:4000/api/v1/model-providers/acme-ai/models/acme-vision",
        {
          method: "DELETE"
        }
      );
    });
    expect(screen.queryByText("Acme Vision")).not.toBeInTheDocument();
  });
});
