# User Message Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-centered chat navigator that previews, tracks, and scrolls to non-empty user messages.

**Architecture:** The message list exposes stable user-message DOM anchors, while an independent navigator filters message data and measures those anchors against the chat scroll container. The workspace owns the scroll ref and composes both pieces; CSS variables provide theme-aware visual states.

**Tech Stack:** React 19, strict TypeScript, Ant Design 6 `Popover`, CSS variables, Vitest, Testing Library.

---

## File Map

- Create `apps/web/src/modules/chat/user-message-navigator/index.tsx`: filtering, active-marker measurement, popovers, and click navigation.
- Create `apps/web/src/modules/chat/user-message-navigator/index.css`: fixed viewport placement and marker interaction styling.
- Create `apps/web/src/modules/chat/user-message-navigator/index.test.tsx`: navigator behavior tests.
- Modify `apps/web/src/modules/agent-messages/message-list/index.tsx`: add stable wrappers around visible user messages.
- Create `apps/web/src/modules/agent-messages/message-list/user-message-anchor.test.tsx`: verify user anchors and continuation-sentinel exclusion without growing the existing test file beyond 500 lines.
- Modify `apps/web/src/modules/chat/chat-workspace.tsx`: own the scroll ref and compose the overlay navigator.
- Create `apps/web/src/modules/chat/chat-workspace.user-message-navigator.test.tsx`: verify navigator composition without growing the existing test file beyond 500 lines.
- Modify `apps/web/src/app/theme.css`: define light and dark marker variables.

### Task 1: Stable User Message Anchors

- [ ] Add a failing message-list test asserting that a visible user message is wrapped by an element with `data-user-message-id`, while an empty continuation message has no anchor.
- [ ] Run `corepack pnpm exec vitest run apps/web/src/modules/agent-messages/message-list/user-message-anchor.test.tsx` and confirm the new assertion fails because the attribute is absent.
- [ ] Update `AgentMessageItem` to render eligible user bubbles inside a wrapper carrying `data-user-message-id={message.id}`; retain existing filtering of the empty continuation sentinel.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Independent Navigator Component

- [ ] Add failing component tests with string and text-block user content asserting: blank messages are filtered, eligible markers render as labelled buttons, the first marker is initially active, scrolling selects the last anchor at or above the 60px observation line, hovering shows the full message, and clicking calls `scrollTo({ behavior: "smooth", top })` with `currentScrollTop + targetTop - containerTop - 60`.
- [ ] Run `corepack pnpm exec vitest run apps/web/src/modules/chat/user-message-navigator/index.test.tsx` and confirm failure because the component does not exist.
- [ ] Implement an explicit `UserMessageNavigatorProps` API accepting `messages: WebPlugin.AgentMessage[]` and `scrollContainerRef: RefObject<HTMLDivElement | null>`.
- [ ] Implement local text extraction for user string/text-block content, trimmed filtering, safe CSS selector lookup using `CSS.escape` with an attribute-value escaping fallback, active-index calculation, scroll-event subscription, and smooth `scrollTo` navigation.
- [ ] Render Ant Design `Popover` with `placement="left"` and one accessible button per eligible user message. Use `aria-current="true"` on the active marker.
- [ ] Add CSS for absolute right-center placement, short default markers, expanded active/hover/focus markers, transitions, stacking, and pointer-safe hit targets.
- [ ] Add `--app-color-chat-nav-marker` and `--app-color-chat-nav-marker-active` values to both theme modes and consume only those variables in component CSS.
- [ ] Re-run the navigator tests and confirm they pass.

### Task 3: Workspace Integration And Regression Verification

- [ ] Add a failing workspace test that mocks `UserMessageNavigator`, asserts it receives the task messages, and verifies it is rendered alongside the message scroll viewport.
- [ ] Run `corepack pnpm exec vitest run apps/web/src/modules/chat/chat-workspace.user-message-navigator.test.tsx` and confirm the composition assertion fails.
- [ ] Add a typed `messageScrollRef`, attach it to `chat-message-scroll`, wrap the scroll viewport in a flexing positioned container, and render `UserMessageNavigator` as its overlay sibling.
- [ ] Ensure the navigator click's untrusted/programmatic scroll does not alter `shouldFollowMessagesRef`; preserve the existing sender and approval layout.
- [ ] Re-run the workspace test and confirm it passes.
- [ ] Run focused regression tests:
  `corepack pnpm exec vitest run apps/web/src/modules/agent-messages/message-list/index.test.tsx apps/web/src/modules/agent-messages/message-list/user-message-anchor.test.tsx apps/web/src/modules/chat/user-message-navigator/index.test.tsx apps/web/src/modules/chat/chat-workspace.test.tsx apps/web/src/modules/chat/chat-workspace.user-message-navigator.test.tsx`.
- [ ] Run `corepack pnpm --filter @hold-rein/web typecheck`.
- [ ] Run `corepack pnpm exec eslint apps/web/src/modules/agent-messages/message-list/index.tsx apps/web/src/modules/chat/chat-workspace.tsx apps/web/src/modules/chat/user-message-navigator`.
- [ ] Run `corepack pnpm --filter @hold-rein/web build`.
- [ ] Inspect `git diff --check` and verify every touched source file remains below 500 lines.
