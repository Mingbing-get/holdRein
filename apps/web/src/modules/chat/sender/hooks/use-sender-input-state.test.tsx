// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSenderInputState } from "./use-sender-input-state";

function createInputElement(value: string, cursorIndex: number): HTMLTextAreaElement {
  const inputElement = document.createElement("textarea");
  inputElement.value = value;
  inputElement.setSelectionRange(cursorIndex, cursorIndex);

  return inputElement;
}

describe("useSenderInputState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates the draft message and notifies message changes", () => {
    const onMessageChange = vi.fn();
    const { result } = renderHook(() =>
      useSenderInputState({
        onMessageChange
      })
    );

    act(() => {
      result.current.handleChangeMessage("hello");
    });

    expect(result.current.draftMessage).toBe("hello");
    expect(onMessageChange).toHaveBeenCalledWith("hello");
  });

  it("clears the draft message after submit succeeds", async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useSenderInputState({
        onSubmit
      })
    );

    act(() => {
      result.current.handleChangeMessage("hello");
    });

    await act(async () => {
      await result.current.handleSubmit("hello");
    });

    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(result.current.draftMessage).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("stops loading when submit rejects and keeps the draft message", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("failed"));
    const { result } = renderHook(() =>
      useSenderInputState({
        onSubmit
      })
    );

    act(() => {
      result.current.handleChangeMessage("hello");
    });

    await expect(
      act(async () => {
        await result.current.handleSubmit("hello");
      })
    ).rejects.toThrow("failed");

    expect(result.current.draftMessage).toBe("hello");
    expect(result.current.loading).toBe(false);
  });

  it("inserts text at the current cursor and moves the cursor after the inserted text", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const { result } = renderHook(() => useSenderInputState({}));
    const inputElement = createInputElement("hello", 2);

    act(() => {
      result.current.handleChangeMessage("hello");
      result.current.senderRef.current = {
        inputElement
      } as never;
    });

    act(() => {
      result.current.insertText(" ");
    });

    expect(result.current.draftMessage).toBe("he llo");
    expect(inputElement.selectionStart).toBe(3);
    expect(inputElement.selectionEnd).toBe(3);
  });

  it("replaces text before the current cursor when an overwrite length is provided", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const { result } = renderHook(() => useSenderInputState({}));
    const inputElement = createInputElement("ship /re later", 8);

    act(() => {
      result.current.handleChangeMessage("ship /re later");
      result.current.senderRef.current = {
        inputElement
      } as never;
    });

    act(() => {
      result.current.insertText("/release", 3);
    });

    expect(result.current.draftMessage).toBe("ship /release later");
    expect(inputElement.selectionStart).toBe(13);
    expect(inputElement.selectionEnd).toBe(13);
  });
});
