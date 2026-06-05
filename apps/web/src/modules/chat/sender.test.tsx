// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  getCurrentCursorCharacterIndex,
  insertTextAtCursor,
  replaceTriggerAtCursor
} from "./sender";

describe("getCurrentCursorCharacterIndex", () => {
  it("returns null when the textarea is unavailable", () => {
    expect(getCurrentCursorCharacterIndex(null)).toBeNull();
  });

  it("returns the current caret index from the textarea", () => {
    expect(
      getCurrentCursorCharacterIndex({
        selectionStart: 2
      })
    ).toBe(2);
  });
});

describe("insertTextAtCursor", () => {
  it("inserts text at the current cursor position", () => {
    expect(insertTextAtCursor("abc", 2, " ")).toBe("ab c");
  });
});

describe("replaceTriggerAtCursor", () => {
  it("replaces only the trigger token around the cursor", () => {
    expect(
      replaceTriggerAtCursor("hello /re world", 9, "/re", "/release checklist")
    ).toBe("hello /release checklist world");
  });

  it("falls back to inserting at the cursor when the token does not match", () => {
    expect(
      replaceTriggerAtCursor("hello world", 5, "/re", "/release checklist")
    ).toBe("hello/release checklist world");
  });
});
