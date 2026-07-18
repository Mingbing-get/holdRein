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
  header?: React.ReactNode;
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
        header,
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
          <div data-testid="sender-header">{header}</div>
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
  const MockSenderHeader = ({ children, open }: {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    styles?: unknown;
  }) => (
    <section data-open={String(Boolean(open))} data-testid="sender-built-in-header">
      {children}
    </section>
  );
  const MockCompoundedSender = Object.assign(MockSender, {
    Header: MockSenderHeader
  });

  const MockAttachments = React.forwardRef<
    { select: () => void },
    {
      beforeUpload?: (file: File) => boolean | Promise<boolean>;
      getDropContainer?: () => HTMLElement | null | undefined;
      items?: Array<{
        imageContent?: unknown;
        name?: string;
        originFileObj?: File;
        status?: string;
        thumbUrl?: string;
        type?: string;
        url?: string;
        uid: string;
      }>;
      onChange?: (info: {
        file: {
          name?: string;
          originFileObj?: File;
          status?: string;
          type?: string;
          uid: string;
        };
        fileList: Array<{
          imageContent?: unknown;
          name?: string;
          originFileObj?: File;
          status?: string;
          thumbUrl?: string;
          type?: string;
          uid: string;
          url?: string;
        }>;
      }) => void;
    }
  >(({ beforeUpload, items = [], onChange }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => ({
      select: () => inputRef.current?.click()
    }));

    return (
      <div data-testid="sender-built-in-attachments">
        <input
          aria-label="选择图片"
          multiple
          ref={inputRef}
          type="file"
          onChange={(event) => {
            const selectedItems = Array.from(
              event.currentTarget.files ?? []
            ).map((file, index) => {
              const item = {
                name: file.name,
                originFileObj: file,
                status: "done",
                type: file.type,
                uid: `${file.name}-${index}`
              };
              void beforeUpload?.(file);
              return item;
            });
            selectedItems.forEach((file) => {
              onChange?.({
                file,
                fileList: [...items, ...selectedItems]
              });
            });
          }}
        />
        {items.map((item) => (
          <span key={item.uid}>
            <img alt={item.name} src={item.thumbUrl ?? item.url} />
            <button
              aria-label={`移除图片 ${item.name}`}
              onClick={() =>
                onChange?.({
                  file: {
                    ...item,
                    status: "removed"
                  },
                  fileList: items.filter(
                    (nextItem) => nextItem.uid !== item.uid
                  )
                })
              }
              type="button"
            >
              移除
            </button>
          </span>
        ))}
      </div>
    );
  });

  return {
    Attachments: MockAttachments,
    Sender: MockCompoundedSender,
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

  it("uses theme variables for custom suggestion group styling", () => {
    const senderSource = readFileSync(
      getWebSourcePath("modules/chat/sender/suggestion-popup.tsx"),
      "utf8"
    );

    expect(senderSource).toContain("data-suggestion-group-title");
    expect(senderSource).toContain("var(--app-color-text-tertiary)");
    expect(senderSource).toContain("var(--app-color-fill-secondary)");
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

  it("shows image upload only for image-capable models and submits selected images", async () => {
    const onSubmit = vi.fn();
    const originalFileReader = globalThis.FileReader;

    class FileReaderMock {
      onload: null | (() => void) = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL() {
        this.result = "data:image/png;base64,cGljdHVyZQ==";
        this.onload?.();
      }
    }

    vi.stubGlobal("FileReader", FileReaderMock);
    try {
      render(
        <Sender
          activeAgent={{
            input: ["text", "image"],
            modelId: "vision-model",
            providerId: "openai"
          }}
          apiBaseUrl=""
          onSubmit={onSubmit}
        />
      );

      fireEvent.change(screen.getByLabelText("消息"), {
        target: { value: "Describe this" }
      });
      fireEvent.click(screen.getByRole("button", { name: "图片附件" }));
      expect(screen.getByTestId("sender-built-in-header")).toHaveAttribute(
        "data-open",
        "true"
      );
      fireEvent.change(screen.getByLabelText("选择图片"), {
        target: {
          files: [
            new File(["picture"], "screen.png", { type: "image/png" })
          ]
        }
      });

      const header = screen.getByTestId("sender-header");
      await waitFor(() => {
        expect(header).toContainElement(screen.getByAltText("screen.png"));
      });
      expect(screen.getByAltText("screen.png")).toHaveAttribute(
        "src",
        "data:image/png;base64,cGljdHVyZQ=="
      );
      expect(screen.getByTestId("sender-footer-tools")).not.toContainElement(
        screen.getByAltText("screen.png")
      );

      fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith("Describe this", [
          {
            data: "cGljdHVyZQ==",
            mimeType: "image/png",
            type: "image"
          }
        ]);
      });
    } finally {
      vi.stubGlobal("FileReader", originalFileReader);
    }
  });

  it("does not show image upload for text-only models and removes selected images", async () => {
    const originalFileReader = globalThis.FileReader;

    class FileReaderMock {
      onload: null | (() => void) = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL() {
        this.result = "data:image/png;base64,cGljdHVyZQ==";
        this.onload?.();
      }
    }

    vi.stubGlobal("FileReader", FileReaderMock);
    try {
      const view = render(
        <Sender
          activeAgent={{
            input: ["text", "image"],
            modelId: "vision-model",
            providerId: "openai"
          }}
          apiBaseUrl=""
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "图片附件" }));
      fireEvent.change(screen.getByLabelText("选择图片"), {
        target: {
          files: [
            new File(["picture"], "screen.png", { type: "image/png" })
          ]
        }
      });

      const header = screen.getByTestId("sender-header");
      await waitFor(() => {
        expect(header).toContainElement(screen.getByAltText("screen.png"));
      });
      fireEvent.click(screen.getByRole("button", { name: "移除图片 screen.png" }));
      await waitFor(() => {
        expect(screen.queryByAltText("screen.png")).not.toBeInTheDocument();
      });

      view.rerender(
        <Sender
          activeAgent={{
            input: ["text"],
            modelId: "text-model",
            providerId: "openai"
          }}
          apiBaseUrl=""
        />
      );

      expect(screen.queryByLabelText("选择图片")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "图片附件" })
      ).not.toBeInTheDocument();
    } finally {
      vi.stubGlobal("FileReader", originalFileReader);
    }
  });

  it("restores the draft when switching back to a task", () => {
    const view = render(
      <Sender apiBaseUrl="" draftKey="sender-test" taskId="task-one" />
    );

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "Draft for task one" }
    });
    view.rerender(
      <Sender apiBaseUrl="" draftKey="sender-test" taskId="task-two" />
    );

    expect(screen.getByLabelText("消息")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "Draft for task two" }
    });
    view.rerender(
      <Sender apiBaseUrl="" draftKey="sender-test" taskId="task-one" />
    );

    expect(screen.getByLabelText("消息")).toHaveValue("Draft for task one");
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

  it("shows the thinking level selector when the active agent does not support reasoning", () => {
    const activeAgent = { modelId: "basic-model", providerId: "local", reasoning: false } as const;

    render(<Sender activeAgent={activeAgent} apiBaseUrl="" />);

    expect(screen.getByLabelText("思考级别")).toBeInTheDocument();
  });

  it("renders plugin sender actions after the model selector with a divider", () => {
    const Render: WebPlugin.SenderAction["Render"] = ({
      draftMessage,
      workspacePath
    }) => (
      <button type="button">
        插件动作:{draftMessage}:{workspacePath}
      </button>
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

    render(<Sender apiBaseUrl="" workspacePath="/tmp/workspace" />);

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "hello" }
    });

    const footerTools = screen.getByTestId("sender-footer-tools");
    expect(footerTools).toHaveTextContent(
      "工作空间选择模型选择中需审批插件动作:hello:/tmp/workspace"
    );

    const dividers = footerTools.querySelectorAll(".ant-divider-vertical");
    expect(dividers).toHaveLength(4);
  });
});
