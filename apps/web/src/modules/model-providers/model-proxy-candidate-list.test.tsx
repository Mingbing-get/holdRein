// @vitest-environment jsdom

import { createRef } from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Form } from "antd";

import { ModelProxyCandidateList } from "./model-proxy-candidate-list";

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

const candidates = [
  {
    limits: [{ maxTokens: 100, windowHours: 24, windowType: "hours" as const }],
    modelId: "model-1",
    provider: "openai"
  },
  {
    limits: [{ maxTokens: 200, windowHours: 24, windowType: "hours" as const }],
    modelId: "model-2",
    provider: "openai"
  }
];

function renderCandidateList() {
  const scrollRef = createRef<HTMLDivElement>();
  render(
    <div data-model-proxy-scroll-container ref={scrollRef}>
      <Form initialValues={{ candidates }}>
        <ModelProxyCandidateList
          candidateProviders={[
            { hasApiKey: true, id: "openai", modelCount: 2, source: "builtin" }
          ]}
          createCandidate={vi.fn()}
          loadProviderModels={vi.fn().mockResolvedValue([])}
          modelOptions={{
            openai: [
              {
                api: "openai-responses",
                contextWindow: 128000,
                id: "model-1",
                input: ["text"],
                maxTokens: 4096,
                name: "Model 1",
                provider: "openai",
                reasoning: false
              },
              {
                api: "openai-responses",
                contextWindow: 128000,
                id: "model-2",
                input: ["text"],
                maxTokens: 4096,
                name: "Model 2",
                provider: "openai",
                reasoning: false
              }
            ]
          }}
        />
      </Form>
    </div>
  );
  if (!scrollRef.current) throw new Error("Expected scroll container");
  return scrollRef.current;
}

describe("ModelProxyCandidateList drag feedback", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
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

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses the complete candidate card as the drag preview", () => {
    renderCandidateList();
    const card = screen.getAllByTestId("model-proxy-candidate-card")[0];
    const handle = screen.getByRole("button", { name: "拖拽候选 1" });
    const setDragImage = vi.fn();

    fireEvent.dragStart(handle, {
      dataTransfer: { effectAllowed: "", setData: vi.fn(), setDragImage }
    });

    expect(setDragImage).toHaveBeenCalledWith(card, expect.any(Number), expect.any(Number));
  });

  it.each([
    { clientY: 80, initialScrollTop: 100, relation: "less" as const },
    { clientY: 520, initialScrollTop: 100, relation: "greater" as const }
  ])("scrolls toward the $relation edge and stops on drag end", ({
    clientY,
    initialScrollTop,
    relation
  }) => {
    const scrollContainer = renderCandidateList();
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: initialScrollTop,
      writable: true
    });
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      height: 400,
      left: 0,
      right: 800,
      top: 100,
      width: 800,
      x: 0,
      y: 100,
      toJSON: () => undefined
    });
    let animationFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        animationFrame = callback;
        return 1;
      });
    const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame");
    const handle = screen.getByRole("button", { name: "拖拽候选 1" });
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn(),
      setDragImage: vi.fn()
    };

    fireEvent.dragStart(handle, { dataTransfer });
    const dragOverEvent = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvent, "clientY", { value: clientY });
    fireEvent(document, dragOverEvent);
    expect(requestAnimationFrame).toHaveBeenCalled();
    animationFrame?.(0);

    if (relation === "less") {
      expect(scrollContainer.scrollTop).toBeLessThan(initialScrollTop);
    } else {
      expect(scrollContainer.scrollTop).toBeGreaterThan(initialScrollTop);
    }

    fireEvent.dragEnd(handle, { dataTransfer });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
