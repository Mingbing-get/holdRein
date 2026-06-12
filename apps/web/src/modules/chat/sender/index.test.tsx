// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS,
} from ".";
import {
  getCurrentCursorCharacterIndex,
  insertTextAtCursor,
  replaceTriggerAtCursor,
  shouldHandleSpaceKeydown,
  shouldHandleSuggestionEnterKeydown
} from "./utils";

function getWebSourcePath(pathFromWebSrc: string): string {
  const pathFromWebPackage = join(process.cwd(), "src", pathFromWebSrc);

  if (existsSync(pathFromWebPackage)) {
    return pathFromWebPackage;
  }

  return join(process.cwd(), "apps", "web", "src", pathFromWebSrc);
}

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

describe("shouldHandleSuggestionEnterKeydown", () => {
  it("returns true for a normal enter keydown while suggestions are open", () => {
    expect(
      shouldHandleSuggestionEnterKeydown(
        {
          code: "Enter",
          isComposing: false,
          nativeEvent: {
            isComposing: false
          }
        },
        true
      )
    ).toBe(true);
  });

  it("returns false when suggestions are closed", () => {
    expect(
      shouldHandleSuggestionEnterKeydown(
        {
          code: "Enter",
          isComposing: false,
          nativeEvent: {
            isComposing: false
          }
        },
        false
      )
    ).toBe(false);
  });

  it("returns false while an input method composition is active", () => {
    expect(
      shouldHandleSuggestionEnterKeydown(
        {
          code: "Enter",
          isComposing: true,
          nativeEvent: {
            isComposing: true
          }
        },
        true
      )
    ).toBe(false);
  });
});

describe("sender suggestion theme styles", () => {
  it("uses the theme text color for the sender caret", () => {
    const senderSource = readFileSync(
      getWebSourcePath("modules/chat/sender/index.tsx"),
      "utf8"
    );

    expect(senderSource).toContain('caretColor: "var(--app-color-text)"');
  });

  it("scopes the selected suggestion text override to the sender popup", () => {
    const themeCss = readFileSync(
      getWebSourcePath("app/theme.css"),
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
