// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS,
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

describe("sender suggestion theme styles", () => {
  it("scopes the selected suggestion text override to the sender popup", () => {
    const themeCss = readFileSync(
      `${process.cwd()}/apps/web/src/app/theme.css`,
      "utf8"
    );

    expect(themeCss.match(/--app-color-text-on-emphasis:/g)).toHaveLength(2);
    expect(themeCss).toContain(
      `.${CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS} .ant-cascader-menu-item-active`
    );
    expect(themeCss).toContain(
      "color: var(--app-color-text-on-emphasis) !important;"
    );
  });
});
