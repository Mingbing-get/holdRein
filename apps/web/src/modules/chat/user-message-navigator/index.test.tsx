// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

beforeAll(() => vi.stubGlobal("ResizeObserver", ResizeObserverMock));
afterAll(() => vi.unstubAllGlobals());

describe("UserMessageNavigator", () => {
  afterEach(cleanup);

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

  it("tracks the message at the observation line and scrolls to markers", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
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

    fireEvent.scroll(scrollContainer);
    expect(screen.getByRole("button", { name: "用户消息 2" }))
      .toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "用户消息 2" }));
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 30 });
  });

  it("uses continuous hit areas with 10px and 20px marker lengths", () => {
    const css = readFileSync(
      "apps/web/src/modules/chat/user-message-navigator/index.css",
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
