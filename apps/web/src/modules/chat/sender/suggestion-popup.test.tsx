// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SenderSuggestionPopup } from "./suggestion-popup";

const suggestionGroups: WebPlugin.SuggestionGroup[] = [
  {
    title: "Files",
    trigger: "/",
    suggestions: Array.from({ length: 12 }, (_, index) => ({
      label: `file-${index}`,
      value: `/file-${index}`
    }))
  }
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SenderSuggestionPopup", () => {
  it("scrolls the active suggestion row into view when keyboard selection changes", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
    const view = render(
      <SenderSuggestionPopup
        activeIndex={0}
        groups={suggestionGroups}
        onSelect={vi.fn()}
      />
    );

    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: "nearest"
    });

    view.rerender(
      <SenderSuggestionPopup
        activeIndex={11}
        groups={suggestionGroups}
        onSelect={vi.fn()}
      />
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: "nearest"
    });
  });
});
