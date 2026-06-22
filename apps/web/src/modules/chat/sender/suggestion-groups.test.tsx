// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Sender from ".";

const mockUseAppPlugins = vi.hoisted(() => vi.fn());

afterEach(() => {
  cleanup();
});

interface MockSenderProps {
  onChange?: (
    value: string,
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
  value?: string;
}

vi.mock("@ant-design/x", () => {
  const MockSender = forwardRef<
    { inputElement: HTMLTextAreaElement | null },
    MockSenderProps
  >(({ onChange, value = "" }, ref) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      inputElement: inputRef.current
    }));

    return (
      <textarea
        aria-label="消息"
        ref={inputRef}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value, event)}
      />
    );
  });

  return {
    Sender: MockSender,
    Suggestion: ({
      children
    }: {
      children: (input: {
        onKeyDown: () => false;
        onTrigger: (info?: unknown) => void;
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

describe("Sender suggestion groups", () => {
  beforeEach(() => {
    mockUseAppPlugins.mockReturnValue({
      senderActions: [],
      senderSuggestions: []
    });
  });

  it("renders group titles as non-selectable rows before their items", () => {
    render(
      <Sender
        apiBaseUrl=""
        suggestionGroups={[
          {
            title: "Commands",
            trigger: "/",
            suggestions: [{ label: "Release", value: "/release" }]
          },
          {
            title: "Files",
            trigger: "/",
            suggestions: [{ label: "README", value: "/README.md" }]
          }
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("消息"), {
      target: { selectionStart: 1, value: "/" }
    });

    expect(screen.getByText("Commands")).toHaveAttribute(
      "data-suggestion-group-title",
      "true"
    );
    expect(screen.getByText("Files")).toHaveAttribute(
      "data-suggestion-group-title",
      "true"
    );
    expect(screen.queryByRole("button", { name: "Commands" })).toBeNull();
    expect(screen.getByRole("option", { name: "Release" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "README" }));

    expect(screen.getByLabelText("消息")).toHaveValue("/README.md");
    expect(screen.queryByText("Commands")).not.toBeInTheDocument();
  });
});
