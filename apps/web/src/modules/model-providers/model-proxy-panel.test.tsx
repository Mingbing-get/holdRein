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

import { ModelProxyPanel } from "./model-proxy-panel";

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

const fetchMock = vi.fn<typeof fetch>();

const emptyProxyResponse = {
  json: async () => ({ code: 0, data: [], msg: "ok" }),
  ok: true
} as Response;

const openAiProviderResponse = {
  json: async () => ({
    code: 0,
    data: [{ hasApiKey: true, id: "openai", modelCount: 1, source: "builtin" }],
    msg: "ok"
  }),
  ok: true
} as Response;

const openAiModelsResponse = {
  json: async () => ({
    code: 0,
    data: [
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
    msg: "ok"
  }),
  ok: true
} as Response;

describe("ModelProxyPanel", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: "",
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined
    }));
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists configured local proxy models from the model proxy API", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: [
          {
            candidates: [],
            modelId: "local-coding-agent",
            name: "Coding Agent"
          }
        ],
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={vi.fn()}
      />
    );

    expect(await screen.findByText("Coding Agent")).toBeVisible();
    expect(screen.getByText("local/local-coding-agent")).toBeVisible();
    expect(screen.getByLabelText("编辑代理 local-coding-agent")).toBeVisible();
    expect(screen.getByLabelText("删除代理 local-coding-agent")).toBeVisible();
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/model-proxies"
    );
  });

  it("floats proxy cards on hover like provider cards", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: [
          {
            candidates: [],
            modelId: "coding-agent",
            name: "coding-agent"
          }
        ],
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={vi.fn()}
      />
    );

    const card = await screen.findByTestId("model-proxy-card");
    expect(card).toHaveStyle({ transform: "translateY(0)" });

    fireEvent.mouseEnter(card);
    expect(card).toHaveStyle({ transform: "translateY(-4px)" });
  });

  it("wraps proxy cards with the same card sizing as provider cards", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: [
          {
            candidates: [],
            modelId: "coding-agent",
            name: "coding-agent"
          }
        ],
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={vi.fn()}
      />
    );

    const card = await screen.findByTestId("model-proxy-card");
    expect(card).toHaveStyle({ flex: "1 1 260px", minWidth: "260px" });
  });

  it("serializes candidate priority and limit rows when creating a proxy", async () => {
    const onChanged = vi.fn();
    fetchMock
      .mockResolvedValueOnce(emptyProxyResponse)
      .mockResolvedValueOnce(openAiProviderResponse)
      .mockResolvedValueOnce(openAiModelsResponse)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: {}, msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce(emptyProxyResponse);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新建代理/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByLabelText("代理模型 ID")).not.toBeInTheDocument();
    expect(screen.getByTestId("model-proxy-candidate-card")).toBeInTheDocument();
    expect(screen.queryByText("移除限制")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("代理名称"), {
      target: { value: "Coding Agent" }
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "http://localhost:4000/api/v1/model-providers/openai/models"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "创建代理" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "http://localhost:4000/api/v1/model-proxies",
        {
          body: JSON.stringify({
            candidates: [
              {
                limits: [
                  {
                    maxTokens: 100000,
                    windowHours: 24,
                    windowType: "hours"
                  }
                ],
                modelId: "gpt-4.1",
                priority: 1,
                provider: "openai"
              }
            ],
            name: "Coding Agent"
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("hides window hours when the limit uses day or week windows", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyProxyResponse)
      .mockResolvedValueOnce(openAiProviderResponse)
      .mockResolvedValueOnce(openAiModelsResponse);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新建代理/ }));
    expect(await screen.findByLabelText("小时")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "窗口" }));
    fireEvent.click(await screen.findByText("UTC 日"));

    await waitFor(() => {
      expect(screen.queryByLabelText("小时")).not.toBeInTheDocument();
    });
  });

  it("uses icon-only buttons for removing candidates and limits", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyProxyResponse)
      .mockResolvedValueOnce(openAiProviderResponse)
      .mockResolvedValueOnce(openAiModelsResponse)
      .mockResolvedValueOnce(openAiProviderResponse)
      .mockResolvedValueOnce(openAiModelsResponse);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新建代理/ }));
    fireEvent.click(await screen.findByRole("button", { name: "添加候选" }));

    expect(await screen.findByLabelText("移除候选 2")).toBeInTheDocument();
    expect(screen.getAllByLabelText("移除限制")).toHaveLength(2);
    expect(screen.queryByText("移除候选")).not.toBeInTheDocument();
    expect(screen.queryByText("移除限制")).not.toBeInTheDocument();
  });

  it("opens edit proxy in a modal and keeps the existing system model id", async () => {
    const onChanged = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              candidates: [
                {
                  limits: [{ maxTokens: 100000, windowHours: 24, windowType: "hours" }],
                  modelId: "gpt-4.1",
                  priority: 1,
                  provider: "openai"
                }
              ],
              modelId: "local-existing",
              name: "Existing Proxy"
            }
          ],
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [{ hasApiKey: true, id: "openai", modelCount: 1, source: "builtin" }],
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce(openAiModelsResponse)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: {}, msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: [], msg: "ok" }),
        ok: true
      } as Response);

    render(
      <ModelProxyPanel
        apiBaseUrl="http://localhost:4000"
        onChanged={onChanged}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /编辑/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByLabelText("代理模型 ID")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("代理名称"), {
      target: { value: "Edited Proxy" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存代理" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "http://localhost:4000/api/v1/model-proxies/local-existing",
        expect.objectContaining({
          body: expect.stringContaining('"modelId":"local-existing"'),
          method: "PUT"
        })
      );
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });
});
