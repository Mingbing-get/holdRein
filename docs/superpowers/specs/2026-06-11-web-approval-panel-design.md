# Web Approval Panel Design

## Goal

Render shell-command approvals as a dedicated panel at the bottom of the chat
message area instead of adding approval requests to the message list. Surface
pending approvals in the left task navigation and support an optional rejection
reason.

## User Experience

Each task owns an ordered queue of pending approvals. When the active task has
pending approvals, the chat message area shows one approval panel below the
message list. The panel displays the oldest request and contains:

1. A full-width `同意` button.
2. A full-width `拒绝` button.
3. A multiline rejection-reason input.

Clicking `同意` submits an approval. Clicking `拒绝` submits a rejection and
includes the trimmed input value when it is non-empty. Pressing Enter in the
input also submits a rejection; Shift+Enter inserts a newline.

While a decision is being submitted, the panel controls are disabled. A
successful decision removes the current approval and displays the next queued
approval, if any. A failed decision leaves the panel visible and reports the
error through the application's message notification API.

The left navigation shows a `待审批` Tag for every task with at least one
pending approval. The Tag appears immediately before the running Spin
indicator. It disappears when the task's approval queue becomes empty.

## Architecture

### Approval State

`AgentTaskState` gains a typed `pendingApprovals` array. The message reducer
handles `approval_requested` events by appending valid approval payloads while
deduplicating by `approvalId`. Approval events remain transient and are not
added to `messages`.

The task context exposes:

- `getPendingApproval(taskId)` for rendering the oldest pending approval;
- `hasPendingApproval(taskId)` for navigation state;
- `decideApproval(taskId, approvalId, approved, reason?)` for submitting a
  decision and removing it from state after success.

### Approval API

The web API module adds a decision request to:

```text
POST /api/v1/agents/:agentId/approvals/:approvalId
```

The JSON body contains `approved` and an optional trimmed `reason`.

The API approval decision contract gains an optional `reason`. The approval
store resolves a structured decision instead of a bare boolean. When the
runtime blocks a rejected command, it uses the supplied reason when present;
otherwise it retains the existing default denial reason.

### Components

`ApprovalPanel` is an isolated component responsible for the command summary,
buttons, rejection input, Enter behavior, and submission loading state.

`ChatWorkspace` places `ApprovalPanel` below `AgentMessageList` inside the
existing message frame. The approval panel is not passed to or rendered by
`AgentMessageList`.

`WorkspaceTask` receives `hasPendingApproval` and renders the `待审批` Tag
before its running Spin.

## Data Flow

1. The active agent emits `approval_requested`.
2. The task subscription dispatches the event into the reducer.
3. The reducer appends the request to that task's pending approval queue.
4. Navigation observes `hasPendingApproval(taskId)` and displays the Tag.
5. The active chat renders the oldest request in `ApprovalPanel`.
6. The user accepts or rejects it.
7. The context posts the decision. On success it removes the request from the
   queue, causing the panel or Tag to disappear when no requests remain.
8. The API runtime resumes the command or blocks it with the optional rejection
   reason.

## Error Handling

- Invalid approval event payloads are ignored.
- Duplicate approval event IDs do not create duplicate panels.
- A failed approval request keeps the request pending so the user can retry.
- Empty or whitespace-only rejection reasons are omitted from the request.
- The backend rejects non-boolean `approved` values and non-string `reason`
  values.

## Testing

Tests are added before implementation and cover:

- reducer approval queue append and deduplication;
- web approval API bodies with and without a rejection reason;
- approval panel accept, reject, Enter, Shift+Enter, and loading behavior;
- provider decision submission and successful queue removal;
- failed decisions remaining pending;
- active chat rendering the panel below the message list;
- task navigation Tag visibility and its position before the running Spin;
- API router validation and forwarding of optional reasons;
- approval store structured decisions and runtime rejection reasons.

Final verification runs focused tests, the complete test suite, TypeScript,
ESLint, the web build, `git diff --check`, and the 500-line file limit check.
