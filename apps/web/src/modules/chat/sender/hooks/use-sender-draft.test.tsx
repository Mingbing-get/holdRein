// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSenderDraft } from "./use-sender-draft";

describe("useSenderDraft", () => {
  it("stores drafts by task id and restores them when the task changes", () => {
    const { rerender, result } = renderHook(
      ({ taskId }) =>
        useSenderDraft({
          draftKey: "chat",
          taskId,
          workspacePath: "/workspace"
        }),
      {
        initialProps: { taskId: "task-one" }
      }
    );

    act(() => {
      result.current.setDraftMessage("first draft");
    });

    rerender({ taskId: "task-two" });

    expect(result.current.draftMessage).toBe("");

    act(() => {
      result.current.setDraftMessage("second draft");
    });

    rerender({ taskId: "task-one" });

    expect(result.current.draftMessage).toBe("first draft");
  });

  it("stores image attachments by task id and restores them when the task changes", () => {
    const imageAttachment = {
      cardType: "image" as const,
      imageContent: {
        data: "cGljdHVyZQ==",
        mimeType: "image/png",
        type: "image" as const
      },
      name: "screen.png",
      status: "done" as const,
      thumbUrl: "data:image/png;base64,cGljdHVyZQ==",
      type: "image/png",
      uid: "screen.png-0",
      url: "data:image/png;base64,cGljdHVyZQ=="
    };
    const { rerender, result } = renderHook(
      ({ taskId }) =>
        useSenderDraft({
          draftKey: "chat-images",
          taskId,
          workspacePath: "/workspace"
        }),
      {
        initialProps: { taskId: "task-one" }
      }
    );

    act(() => {
      result.current.setDraftImageAttachments([imageAttachment]);
    });

    rerender({ taskId: "task-two" });

    expect(result.current.draftImageAttachments).toEqual([]);

    act(() => {
      result.current.setDraftMessage("second draft");
    });
    rerender({ taskId: "task-one" });

    expect(result.current.draftImageAttachments).toEqual([imageAttachment]);
  });

  it("uses the workspace path while there is no active task id", () => {
    const { rerender, result } = renderHook(
      ({ taskId, workspacePath }) =>
        useSenderDraft({
          draftKey: "chat",
          taskId,
          workspacePath
        }),
      {
        initialProps: { taskId: "", workspacePath: "/workspace-one" }
      }
    );

    act(() => {
      result.current.setDraftMessage("new task draft");
    });

    rerender({ taskId: "", workspacePath: "/workspace-two" });

    expect(result.current.draftMessage).toBe("");

    rerender({ taskId: "", workspacePath: "/workspace-one" });

    expect(result.current.draftMessage).toBe("new task draft");
  });

  it("clears only the active draft slot", () => {
    const { rerender, result } = renderHook(
      ({ taskId }) =>
        useSenderDraft({
          draftKey: "chat",
          taskId,
          workspacePath: "/workspace"
        }),
      {
        initialProps: { taskId: "task-one" }
      }
    );

    act(() => {
      result.current.setDraftMessage("first draft");
    });
    rerender({ taskId: "task-two" });
    act(() => {
      result.current.setDraftMessage("second draft");
      result.current.clearDraft();
    });
    rerender({ taskId: "task-one" });

    expect(result.current.draftMessage).toBe("first draft");
  });
});
