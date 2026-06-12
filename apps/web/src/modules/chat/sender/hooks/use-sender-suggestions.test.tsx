// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SuggestionGroup } from "..";
import { useSenderSuggestions } from "./use-sender-suggestions";

const suggestionGroups: SuggestionGroup[] = [
  {
    trigger: "/",
    suggestions: [
      {
        label: "release",
        value: "/release"
      },
      {
        label: "review",
        value: "/review"
      }
    ]
  },
  {
    trigger: "@",
    suggestions: [
      {
        label: "workspace",
        value: "@workspace"
      }
    ]
  }
];

describe("useSenderSuggestions", () => {
  it("returns matching items for a trigger query", () => {
    const { result } = renderHook(() =>
      useSenderSuggestions({
        suggestionGroups
      })
    );

    expect(
      result.current.getItemsByQuery({
        query: "rel",
        trigger: "/"
      })
    ).toEqual([
      {
        label: "release",
        value: "/release"
      }
    ]);
  });

  it("detects a trigger token before the cursor", () => {
    const { result } = renderHook(() =>
      useSenderSuggestions({
        suggestionGroups
      })
    );

    expect(result.current.getTriggerQuery("ship /re later", 8)).toEqual({
      query: "re",
      trigger: "/"
    });
  });

  it("opens suggestions and tracks the current trigger", () => {
    const { result } = renderHook(() =>
      useSenderSuggestions({
        suggestionGroups
      })
    );

    act(() => {
      result.current.openSuggestionForTrigger({
        query: "re",
        trigger: "/"
      });
    });

    expect(result.current.suggestionOpen).toBe(true);
    expect(result.current.currentTrigger.current).toEqual({
      query: "re",
      trigger: "/"
    });

    act(() => {
      result.current.closeSuggestions();
    });

    expect(result.current.suggestionOpen).toBe(false);
    expect(result.current.currentTrigger.current).toBeNull();
  });
});
