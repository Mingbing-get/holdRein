// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS,
  getCurrentCursorCharacterIndex,
  insertTextAtCursor,
  replaceTriggerAtCursor,
  shouldHandleSpaceKeydown
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

describe("shouldHandleSpaceKeydown", () => {
  it("returns true for a normal space keydown", () => {
    expect(
      shouldHandleSpaceKeydown({
        code: "Space",
        isComposing: false,
        nativeEvent: {
          isComposing: false
        }
      })
    ).toBe(true);
  });

  it("returns false while an input method composition is active", () => {
    expect(
      shouldHandleSpaceKeydown({
        code: "Space",
        isComposing: true,
        nativeEvent: {
          isComposing: true
        }
      })
    ).toBe(false);
  });
});

describe("sender suggestion theme styles", () => {
  it("uses the theme text color for the sender caret", () => {
    const senderSource = readFileSync(
      `${process.cwd()}/apps/web/src/modules/chat/sender.tsx`,
      "utf8"
    );

    expect(senderSource).toContain('caretColor: "var(--app-color-text)"');
  });

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
