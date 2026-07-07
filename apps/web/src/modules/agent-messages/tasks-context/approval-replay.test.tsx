// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppWorkspaceProvider, useAppWorkspace } from "../../../app/app-workspace-context";
import type { AgentMessageFetcher } from "../api";
import { AgentTasksProvider, useAgentTasks } from ".";
import { jsonResponse, streamResponse } from "./test-utils";

describe("AgentTasksProvider approval replay", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits and removes a pending approval", async () => {
    const fetcher = createReplayedApprovalFetcher();

    renderApprovalProbe(fetcher, { approved: false });

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent(
        "approval-1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "拒绝审批" }));

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent("none");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-approval/approvals/approval-1",
      expect.objectContaining({
        body: JSON.stringify({ approved: false, reason: "Not now" })
      })
    );
  });

  it("keeps a pending approval when submission fails", async () => {
    const fetcher = createReplayedApprovalFetcher({ failDecision: true });

    renderApprovalProbe(fetcher, { approved: false });

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent(
        "approval-1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "拒绝审批" }));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/agents/agent-approval/approvals/approval-1",
        expect.anything()
      );
    });
    expect(screen.getByTestId("pending-approval")).toHaveTextContent(
      "approval-1"
    );
  });

  it("does not show a replayed approval after it was already decided", async () => {
    const fetcher = createReplayedApprovalFetcher();
    const firstRender = renderApprovalProbe(fetcher);

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent(
        "approval-1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "同意审批" }));

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent("none");
    });
    firstRender.unmount();

    renderApprovalProbe(fetcher);

    await waitFor(() => {
      expect(countEventSubscriptions(fetcher)).toBe(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent("none");
    });
  });
});

interface ApprovalProbeOptions {
  approved?: boolean;
}

function renderApprovalProbe(
  fetcher: AgentMessageFetcher,
  options: ApprovalProbeOptions = {}
) {
  return render(
    <AppWorkspaceProvider>
      <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
        <ApprovalProbe approved={options.approved ?? true} />
      </AgentTasksProvider>
    </AppWorkspaceProvider>
  );
}

function ApprovalProbe({ approved }: { approved: boolean }) {
  const { setWorkspaces } = useAppWorkspace();
  const { decideApproval, getPendingApproval } = useAgentTasks();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-1",
        name: "workspace",
        path: "/workspace",
        tasks: [
          {
            activeAgentId: "agent-approval",
            id: "task-approval",
            initialUserMessage: "Inspect",
            lastContinuedAt: "2026-06-11T00:00:00.000Z",
            lastModelName: "gpt-4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "running",
            title: "Inspect"
          }
        ]
      }
    ]);
  }, [setWorkspaces]);

  const approval = getPendingApproval("task-approval");

  return (
    <>
      <span data-testid="pending-approval">{approval?.approvalId ?? "none"}</span>
      <button
        onClick={() =>
          void decideApproval(
            "task-approval",
            "approval-1",
            approved,
            approved ? undefined : "Not now"
          ).catch(() => undefined)
        }
      >
        {approved ? "同意审批" : "拒绝审批"}
      </button>
    </>
  );
}

function createReplayedApprovalFetcher(
  options: { failDecision?: boolean } = {}
): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();
  let decision: { approved: boolean } | undefined;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/approvals/approval-1")) {
      if (options.failDecision) {
        return new Response(null, { status: 500 });
      }
      const submittedDecision =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as { approved?: boolean })
          : {};
      const approved = submittedDecision.approved === true;
      decision = { approved };
      return jsonResponse({
        agentId: "agent-approval",
        approvalId: "approval-1",
        approved
      });
    }
    if (url.endsWith("/messages")) {
      return jsonResponse({ messages: [], subagents: [] });
    }
    return streamResponse((controller) => {
      const approvalStatus =
        decision === undefined
          ? { status: "pending" }
          : { approved: decision.approved, status: "decided" };
      controller.enqueue(
        encoder.encode(
          `${JSON.stringify({
            agentId: "agent-approval",
            payload: {
              agentId: "agent-approval",
              approvalId: "approval-1",
              ...approvalStatus,
              tool: {
                input: {},
                name: "workspace_patch",
                toolCallId: "tool-call-1"
              }
            },
            sequence: 1,
            timestamp: "now",
            type: "approval_requested"
          })}\n`
        )
      );
    });
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function countEventSubscriptions(fetcher: ReturnType<typeof vi.fn>): number {
  return fetcher.mock.calls.filter(([input]) =>
    String(input).endsWith("/api/v1/agents/agent-approval/events")
  ).length;
}
