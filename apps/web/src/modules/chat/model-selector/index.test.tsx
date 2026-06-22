// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ModelSelector,
  buildConfiguredProviderOptions,
  isModelSelection
} from ".";

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

function getWebSourcePath(pathFromWebSrc: string): string {
  const pathFromWebPackage = join(process.cwd(), "src", pathFromWebSrc);

  if (existsSync(pathFromWebPackage)) {
    return pathFromWebPackage;
  }

  return join(process.cwd(), "apps", "web", "src", pathFromWebSrc);
}

describe("buildConfiguredProviderOptions", () => {
  it("keeps only providers with configured API keys", () => {
    expect(
      buildConfiguredProviderOptions([
        { hasApiKey: false, id: "openai", modelCount: 2, source: "builtin" },
        { hasApiKey: true, id: "anthropic", modelCount: 1, source: "builtin" }
      ])
    ).toEqual([
      {
        children: [],
        isLeaf: false,
        label: "anthropic",
        value: "anthropic"
      }
    ]);
  });
});

describe("isModelSelection", () => {
  it("returns true only for provider and model values", () => {
    expect(isModelSelection(["anthropic"])).toBe(false);
    expect(isModelSelection(["anthropic", "claude-3-5-sonnet"])).toBe(true);
  });
});

describe("ModelSelector", () => {
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

  it("shows only configured providers and selects models from the second level", async () => {
    const onChange = vi.fn();

    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            { hasApiKey: false, id: "openai", modelCount: 2, source: "builtin" },
            { hasApiKey: true, id: "anthropic", modelCount: 1, source: "builtin" }
          ],
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "chat",
              contextWindow: 200000,
              id: "claude-3-5-sonnet",
              input: ["text"],
              maxTokens: 8192,
              name: "Claude 3.5 Sonnet",
              provider: "anthropic",
              reasoning: true
            }
          ],
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(<ModelSelector apiBaseUrl="http://localhost:4000" onChange={onChange} />);

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "模型" }));

    expect(await screen.findByTitle("anthropic")).toBeInTheDocument();
    expect(screen.queryByText("openai")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("anthropic"));
    fireEvent.click(await screen.findByTitle("Claude 3.5 Sonnet"));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        modelId: "claude-3-5-sonnet",
        providerId: "anthropic",
        reasoning: true
      });
    });
  });

  it("uses content-sized popup width and disables clearing", () => {
    const modelSelectorSource = readFileSync(
      getWebSourcePath("modules/chat/model-selector/index.tsx"),
      "utf8"
    );

    expect(modelSelectorSource).toContain("popupMatchSelectWidth={false}");
    expect(modelSelectorSource).toContain("allowClear={false}");
  });

  it("uses app theme variables for cascader colors", () => {
    const modelSelectorSource = readFileSync(
      getWebSourcePath("modules/chat/model-selector/index.tsx"),
      "utf8"
    );

    expect(modelSelectorSource).toContain('colorText: "var(--app-color-text)"');
    expect(modelSelectorSource).toContain("optionSelectedBg");
    expect(modelSelectorSource).toContain(
      'style={{ width: "fit-content" }}'
    );
  });
});
