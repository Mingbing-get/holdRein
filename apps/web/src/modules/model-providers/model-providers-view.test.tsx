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
});
