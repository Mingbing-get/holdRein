// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Sender from ".";

const mockUseAppPlugins = vi.hoisted(() => vi.fn());

interface MockSenderProps {
  disabled?: boolean;
  footer?: (
    actionNode: React.ReactNode,
    info: { components: MockActionComponents }
  ) => React.ReactNode;
  header?: React.ReactNode;
  loading?: boolean;
  onChange?: (
    value: string,
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
  value?: string;
}

interface MockActionButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

interface MockActionComponents {
  LoadingButton: React.ComponentType<MockActionButtonProps>;
  SendButton: React.ComponentType<MockActionButtonProps>;
}

type MockAttachmentItem = {
  imageContent?: unknown;
  name?: string;
  originFileObj?: File;
  status?: string;
  thumbUrl?: string;
  type?: string;
  uid: string;
  url?: string;
};

vi.mock("@ant-design/x", () => {
  const MockSender = forwardRef<
    { inputElement: HTMLTextAreaElement | null },
    MockSenderProps
  >(({ disabled, footer, header, loading, onChange, value = "" }, ref) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const SendButton = ({ disabled: actionDisabled }: MockActionButtonProps) => (
      <button
        aria-label="发送消息"
        disabled={actionDisabled ?? disabled ?? !value.trim()}
      >
        发送消息
      </button>
    );
    const LoadingButton = () => <button aria-label="正在发送">正在发送</button>;

    useImperativeHandle(ref, () => ({
      inputElement: inputRef.current
    }));

    return (
      <div data-loading={String(Boolean(loading))}>
        <div data-testid="sender-header">{header}</div>
        <textarea
          aria-label="消息"
          ref={inputRef}
          value={value}
          onChange={(event) => onChange?.(event.currentTarget.value, event)}
        />
        {footer?.(null, {
          components: {
            LoadingButton,
            SendButton
          }
        })}
      </div>
    );
  });
  const MockSenderHeader = ({
    children,
    open
  }: {
    children?: React.ReactNode;
    open?: boolean;
  }) => (
    <section data-open={String(Boolean(open))} data-testid="sender-built-in-header">
      {children}
    </section>
  );
  const MockAttachments = ({
    beforeUpload,
    items = [],
    onChange
  }: {
    beforeUpload?: (file: File) => boolean | Promise<boolean>;
    items?: MockAttachmentItem[];
    onChange?: (info: {
      file: MockAttachmentItem;
      fileList: MockAttachmentItem[];
    }) => void;
  }) => (
    <div data-testid="sender-built-in-attachments">
      <input
        aria-label="选择图片"
        multiple
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
        <img
          alt={item.name}
          key={item.uid}
          src={item.thumbUrl ?? item.url}
        />
      ))}
    </div>
  );

  return {
    Attachments: MockAttachments,
    Sender: Object.assign(MockSender, {
      Header: MockSenderHeader
    })
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

describe("Sender image draft restoration", () => {
  beforeEach(() => {
    mockUseAppPlugins.mockReturnValue({
      senderActions: [],
      senderSuggestions: []
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("restores draft text and images when switching back to a task", async () => {
    stubImageFileReader();
    const activeAgent = {
      input: ["text", "image"],
      modelId: "vision-model",
      providerId: "openai"
    };
    const view = render(
      <Sender
        activeAgent={activeAgent}
        apiBaseUrl=""
        draftKey="sender-image-restore-test"
        taskId="task-one"
      />
    );

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { value: "Describe this" }
    });
    fireEvent.click(screen.getByRole("button", { name: "图片附件" }));
    uploadImage();

    await waitFor(() => {
      expect(screen.getByAltText("screen.png")).toBeInTheDocument();
    });

    view.rerender(
      <Sender
        activeAgent={activeAgent}
        apiBaseUrl=""
        draftKey="sender-image-restore-test"
        taskId="task-two"
      />
    );

    await waitFor(() => {
      expect(screen.queryByAltText("screen.png")).not.toBeInTheDocument();
    });

    view.rerender(
      <Sender
        activeAgent={activeAgent}
        apiBaseUrl=""
        draftKey="sender-image-restore-test"
        taskId="task-one"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("消息")).toHaveValue("Describe this");
      expect(screen.getByAltText("screen.png")).toHaveAttribute(
        "src",
        "data:image/png;base64,cGljdHVyZQ=="
      );
    });
  });

  it("keeps draft images while restored task model capabilities are loading", async () => {
    stubImageFileReader();
    const imageCapableAgent = {
      input: ["text", "image"],
      modelId: "vision-model",
      providerId: "openai"
    };
    const restoringAgent = {
      modelId: "vision-model",
      providerId: "openai"
    };
    const view = render(
      <Sender
        activeAgent={imageCapableAgent}
        apiBaseUrl=""
        draftKey="sender-image-capability-loading-test"
        taskId="task-one"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "图片附件" }));
    uploadImage();

    await waitFor(() => {
      expect(screen.getByAltText("screen.png")).toBeInTheDocument();
    });

    view.rerender(
      <Sender
        activeAgent={imageCapableAgent}
        apiBaseUrl=""
        draftKey="sender-image-capability-loading-test"
        taskId="task-two"
      />
    );
    view.rerender(
      <Sender
        activeAgent={restoringAgent}
        apiBaseUrl=""
        draftKey="sender-image-capability-loading-test"
        taskId="task-one"
      />
    );

    expect(
      screen.queryByRole("button", { name: "图片附件" })
    ).not.toBeInTheDocument();

    view.rerender(
      <Sender
        activeAgent={imageCapableAgent}
        apiBaseUrl=""
        draftKey="sender-image-capability-loading-test"
        taskId="task-one"
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText("screen.png")).toHaveAttribute(
        "src",
        "data:image/png;base64,cGljdHVyZQ=="
      );
    });
  });
});

function stubImageFileReader(): void {
  class FileReaderMock {
    onload: null | (() => void) = null;
    result: string | ArrayBuffer | null = null;

    readAsDataURL() {
      this.result = "data:image/png;base64,cGljdHVyZQ==";
      this.onload?.();
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
}

function uploadImage(): void {
  fireEvent.change(screen.getByLabelText("选择图片"), {
    target: {
      files: [
        new File(["picture"], "screen.png", { type: "image/png" })
      ]
    }
  });
}
