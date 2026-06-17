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
