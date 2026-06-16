// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS,
} from ".";
import Sender from ".";
import {
  getCurrentCursorCharacterIndex,
  insertTextAtCursor,
  replaceTriggerAtCursor,
  shouldHandleSpaceKeydown,
  shouldHandleSuggestionEnterKeydown
} from "./utils";

const mockUseAppPlugins = vi.hoisted(() => vi.fn());

afterEach(() => {
  cleanup();
});

interface MockSenderProps {
  disabled?: boolean;
  footer?:
    | React.ReactNode
    | ((
        actionNode: React.ReactNode,
        info: { components: MockActionsComponents }
      ) => React.ReactNode);
  loading?: boolean;
  onChange?: (
    value: string,
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => false | undefined;
  onSubmit?: (message: string) => void;
  suffix?: React.ReactNode;
  value?: string;
}

interface MockActionButtonProps {
  "aria-label"?: string;
  disabled?: boolean;
  onClick?: () => void;
  size?: string;
}

interface MockActionsComponents {
  LoadingButton: React.ComponentType<MockActionButtonProps>;
  SendButton: React.ComponentType<MockActionButtonProps>;
}

vi.mock("@ant-design/x", () => {
  const MockSender = forwardRef<
    { inputElement: HTMLTextAreaElement | null },
    MockSenderProps
  >(
    (
      {
        disabled,
        footer,
        loading,
        onChange,
        onKeyDown,
        onSubmit,
        suffix,
        value = ""
      },
      ref
    ) => {
      const inputRef = useRef<HTMLTextAreaElement>(null);
      const SendButton = ({
        disabled: actionDisabled,
        onClick
      }: MockActionButtonProps) => (
        <button
          aria-label="发送消息"
          disabled={actionDisabled ?? disabled ?? !value.trim()}
          onClick={() => {
            onSubmit?.(value);
            onClick?.();
          }}
        >
          发送消息
        </button>
      );
      const LoadingButton = ({
        "aria-label": ariaLabel = "正在发送",
        disabled: actionDisabled,
        onClick
      }: MockActionButtonProps) => (
        <button
          aria-label={ariaLabel}
          disabled={actionDisabled}
          onClick={onClick}
        >
          {ariaLabel}
        </button>
      );
      const actionNode = loading ? <LoadingButton /> : <SendButton />;
      const footerNode =
        typeof footer === "function"
          ? footer(actionNode, {
              components: {
                LoadingButton,
                SendButton
              }
            })
          : footer;

      useImperativeHandle(ref, () => ({
        inputElement: inputRef.current
      }));

      return (
        <div data-loading={String(Boolean(loading))}>
          <textarea
            aria-label="消息"
            disabled={disabled}
            ref={inputRef}
            value={value}
            onChange={(event) => onChange?.(event.currentTarget.value, event)}
            onKeyDown={(event) => {
              const eventResult = onKeyDown?.(event);
              if (
                event.key === "Enter" &&
                eventResult !== false &&
                (suffix !== false || typeof footer === "function")
              ) {
                onSubmit?.(value);
              }
            }}
          />
          <button onClick={() => onSubmit?.(value)}>内置发送</button>
          <span data-testid="sender-suffix">{String(suffix)}</span>
          {footerNode}
        </div>
      );
    }
  );

  return {
    Sender: MockSender,
    Suggestion: ({
      children
    }: {
      children: (input: {
        onKeyDown: () => false;
        onTrigger: () => void;
      }) => React.ReactNode;
    }) => (
      <>
        {children({
          onKeyDown: vi.fn((): false => false),
          onTrigger: vi.fn()
        })}
      </>
    )
  };
});

vi.mock("../model-selector", () => ({
  ModelSelector: () => <span>模型选择</span>
}));

vi.mock("../workspace-selector", () => ({
  WorkspaceSelector: () => <span>工作空间选择</span>
}));

vi.mock("../../../app/app-plugin", () => ({
  useAppPlugins: mockUseAppPlugins
}));

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

describe("Sender action button", () => {
  beforeEach(() => {
    mockUseAppPlugins.mockReturnValue({
      senderActions: [],
      senderSuggestions: []
    });
  });

  it("disables the footer send button when the sender is disabled", () => {
    render(<Sender apiBaseUrl="" disabled />);

    expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  });

  it("disables the footer send button when the draft is empty", () => {
    render(<Sender apiBaseUrl="" />);

    expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  });

  it("submits the draft from the footer action button", async () => {
    const onSubmit = vi.fn();
    render(<Sender apiBaseUrl="" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "Inspect this project" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("Inspect this project");
    });
  });

  it("submits the draft with Enter when suggestions are closed", async () => {
    const onSubmit = vi.fn();
    render(<Sender apiBaseUrl="" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { selectionStart: 20, value: "Inspect this project" }
    });
    fireEvent.keyDown(screen.getByLabelText("消息"), {
      code: "Enter",
      key: "Enter"
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("Inspect this project");
    });
  });

  it("does not submit the draft with Enter while suggestions are open", async () => {
    const onSubmit = vi.fn();
    render(
      <Sender
        apiBaseUrl=""
        suggestionGroups={[
          {
            trigger: "/",
            suggestions: [{ label: "Release", value: "/release" }]
          }
        ]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { selectionStart: 1, value: "/" }
    });
    fireEvent.keyDown(screen.getByLabelText("消息"), {
      code: "Enter",
      key: "Enter"
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the footer loading action while submit is pending", async () => {
    let resolveSubmit: (() => void) | undefined;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    render(<Sender apiBaseUrl="" onSubmit={() => submitPromise} />);

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "Inspect this project" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

    expect(
      await screen.findByRole("button", { name: "正在发送" })
    ).toBeInTheDocument();
    await act(async () => {
      resolveSubmit?.();
      await submitPromise;
    });
  });

  it("uses the footer action button to cancel a running task", () => {
    const onCancel = vi.fn();
    render(<Sender apiBaseUrl="" running onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "中断执行" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders plugin sender actions after the model selector with a divider", () => {
    const Render: WebPlugin.SenderAction["Render"] = ({ draftMessage }) => (
      <button type="button">插件动作:{draftMessage}</button>
    );

    mockUseAppPlugins.mockReturnValue({
      senderActions: [
        {
          id: "plugin_action",
          Render
        }
      ],
      senderSuggestions: []
    });

    render(<Sender apiBaseUrl="" />);

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "hello" }
    });

    const footerTools = screen.getByTestId("sender-footer-tools");
    expect(footerTools).toHaveTextContent(
      "工作空间选择模型选择插件动作:hello"
    );

    const dividers = footerTools.querySelectorAll(".ant-divider-vertical");
    expect(dividers).toHaveLength(2);
  });
});
