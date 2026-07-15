// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { WebPlugin } from "@hold-rein/plugin-web";
import { UserMessageNavigator } from ".";

const messages: WebPlugin.AgentMessage[] = [
  { content: "First question", id: "user-1", role: "user", timestamp: 1 },
  { content: "   ", id: "blank", role: "user", timestamp: 2 },
  {
    content: [{ text: "Second question", type: "text" }],
    id: "user-2",
    role: "user",
    timestamp: 3
  }
];

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

interface ObservedIntersection {
  readonly disconnect: ReturnType<typeof vi.fn>;
  readonly observe: ReturnType<typeof vi.fn>;
  readonly trigger: (entries: IntersectionObserverEntry[]) => void;
  readonly unobserve: ReturnType<typeof vi.fn>;
}

const intersectionObservers: ObservedIntersection[] = [];

class IntersectionObserverMock {
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  readonly takeRecords = vi.fn(() => []);
  readonly unobserve = vi.fn();

  constructor(
    private readonly callback: IntersectionObserverCallback
  ) {
    intersectionObservers.push({
      disconnect: this.disconnect,
      observe: this.observe,
      trigger: (entries) => this.callback(entries, this as IntersectionObserver),
      unobserve: this.unobserve
    });
  }
}

beforeAll(() => vi.stubGlobal("ResizeObserver", ResizeObserverMock));
afterAll(() => vi.unstubAllGlobals());

describe("UserMessageNavigator", () => {
  beforeAll(() =>
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  );

  afterEach(() => {
    cleanup();
    intersectionObservers.length = 0;
  });

  it("renders markers for non-empty user messages and previews their text", async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollContainerRef}>
        <UserMessageNavigator
          messages={messages}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "用户消息 1" }))
      .toHaveAttribute("aria-current", "true");

    fireEvent.mouseEnter(screen.getByRole("button", { name: "用户消息 2" }));
    expect(await screen.findByText("Second question")).toBeInTheDocument();
  });

  it("tracks the intersecting message without subscribing to scroll and scrolls to markers", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const scrollTo = vi.fn();
    const { container } = render(
      <div ref={scrollContainerRef}>
        <div data-user-message-id="user-1" />
        <div data-user-message-id="user-2" />
        <UserMessageNavigator
          messages={messages}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );
    const scrollContainer = scrollContainerRef.current;
    const anchors = container.querySelectorAll<HTMLElement>(
      "[data-user-message-id]"
    );
    const firstAnchor = anchors[0];
    const secondAnchor = anchors[1];
    if (!scrollContainer || !firstAnchor || !secondAnchor) {
      throw new Error("Expected the scroll container and both message anchors");
    }
    Object.defineProperties(scrollContainer, {
      addEventListener: { configurable: true, value: addEventListener },
      removeEventListener: { configurable: true, value: removeEventListener },
      scrollTo: { configurable: true, value: scrollTo },
      scrollTop: { configurable: true, value: 40, writable: true }
    });
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(
      rect({ top: 100 })
    );
    vi.spyOn(firstAnchor, "getBoundingClientRect").mockReturnValue(
      rect({ top: 120 })
    );
    vi.spyOn(secondAnchor, "getBoundingClientRect").mockReturnValue(
      rect({ top: 150 })
    );

    expect(intersectionObservers).toHaveLength(1);
    expect(intersectionObservers[0]?.observe).toHaveBeenCalledWith(firstAnchor);
    expect(intersectionObservers[0]?.observe).toHaveBeenCalledWith(secondAnchor);
    expect(addEventListener).not.toHaveBeenCalledWith(
      "scroll",
      expect.any(Function)
    );

    act(() => {
      intersectionObservers[0]?.trigger([
        intersectionEntry({
          isIntersecting: true,
          target: secondAnchor,
          top: 150
        })
      ]);
    });
    expect(screen.getByRole("button", { name: "用户消息 2" }))
      .toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "用户消息 2" }));
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 30 });
  });

  it("initializes to the last message that has crossed the observation line", () => {
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if ((this as HTMLElement).dataset.userMessageId === "user-1") {
          return rect({ top: 120 });
        }
        if ((this as HTMLElement).dataset.userMessageId === "user-2") {
          return rect({ top: 150 });
        }
        return rect({ top: 100 });
      });
    const scrollContainerRef = createRef<HTMLDivElement>();
    render(
      <div ref={scrollContainerRef}>
        <div data-user-message-id="user-1" />
        <div data-user-message-id="user-2" />
        <UserMessageNavigator
          messages={messages}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );

    expect(screen.getByRole("button", { name: "用户消息 2" }))
      .toHaveAttribute("aria-current", "true");

    getBoundingClientRect.mockRestore();
  });

  it("keeps the previous message active until the next anchor crosses the observation line", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={scrollContainerRef}>
        <div data-user-message-id="user-1" />
        <div data-user-message-id="user-2" />
        <UserMessageNavigator
          messages={messages}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );
    const scrollContainer = scrollContainerRef.current;
    const anchors = container.querySelectorAll<HTMLElement>(
      "[data-user-message-id]"
    );
    const firstAnchor = anchors[0];
    const secondAnchor = anchors[1];
    if (!scrollContainer || !firstAnchor || !secondAnchor) {
      throw new Error("Expected the scroll container and both message anchors");
    }
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(
      rect({ top: 100 })
    );
    vi.spyOn(firstAnchor, "getBoundingClientRect").mockReturnValue(
      rect({ top: 120 })
    );
    vi.spyOn(secondAnchor, "getBoundingClientRect").mockReturnValue(
      rect({ top: 170 })
    );

    act(() => {
      intersectionObservers[0]?.trigger([
        intersectionEntry({
          isIntersecting: true,
          target: firstAnchor,
          top: 120
        }),
        intersectionEntry({
          isIntersecting: true,
          target: secondAnchor,
          top: 170
        })
      ]);
    });
    expect(screen.getByRole("button", { name: "用户消息 1" }))
      .toHaveAttribute("aria-current", "true");

    vi.spyOn(secondAnchor, "getBoundingClientRect").mockReturnValue(
      rect({ top: 150 })
    );
    act(() => {
      intersectionObservers[0]?.trigger([
        intersectionEntry({
          isIntersecting: true,
          target: secondAnchor,
          top: 150
        })
      ]);
    });
    expect(screen.getByRole("button", { name: "用户消息 2" }))
      .toHaveAttribute("aria-current", "true");
  });

  it("keeps the same observer when non-user messages update", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const assistantMessage: WebPlugin.AssistantMessage = {
      api: "responses",
      content: [{ text: "First answer", type: "text" }],
      id: "assistant-1",
      model: "test-model",
      provider: "test-provider",
      role: "assistant",
      stopReason: "stop",
      timestamp: 4
    };
    const { rerender } = render(
      <div ref={scrollContainerRef}>
        <div data-user-message-id="user-1" />
        <div data-user-message-id="user-2" />
        <UserMessageNavigator
          messages={[...messages, assistantMessage]}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );

    expect(intersectionObservers).toHaveLength(1);

    rerender(
      <div ref={scrollContainerRef}>
        <div data-user-message-id="user-1" />
        <div data-user-message-id="user-2" />
        <UserMessageNavigator
          messages={[
            ...messages,
            {
              ...assistantMessage,
              content: [{ text: "First answer delta", type: "text" }]
            }
          ]}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );

    expect(intersectionObservers).toHaveLength(1);
    expect(intersectionObservers[0]?.disconnect).not.toHaveBeenCalled();
  });

  it("uses continuous hit areas with 10px and 20px marker lengths", () => {
    const css = readFileSync(
      "src/modules/chat/user-message-navigator/index.css",
      "utf8"
    );

    expect(css).toContain("gap: 0");
    expect(css).toContain("width: 10px");
    expect(css).toContain("width: 20px");
    expect(css).toContain(".user-message-navigator__marker::after");
  });
});

function rect({ top }: { top: number }): DOMRect {
  return {
    bottom: top,
    height: 0,
    left: 0,
    right: 0,
    top,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({})
  };
}

function intersectionEntry({
  isIntersecting,
  target,
  top
}: {
  isIntersecting: boolean;
  target: Element;
  top: number;
}): IntersectionObserverEntry {
  return {
    boundingClientRect: rect({ top }),
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: rect({ top }),
    isIntersecting,
    rootBounds: rect({ top: 100 }),
    target,
    time: 0
  };
}
