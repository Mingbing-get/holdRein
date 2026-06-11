# Assistant Markdown Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render assistant message text as theme-aware GitHub-flavored Markdown.

**Architecture:** Create an isolated Markdown renderer that assembles
`react-markdown` and `remark-gfm`, then use it only in assistant text blocks.
Keep visual tokens in the central theme file and Markdown layout in a colocated
stylesheet.

**Tech Stack:** React, TypeScript, react-markdown, remark-gfm, Ant Design X,
Vitest, Testing Library

---

### Task 1: Markdown component behavior

**Files:**
- Create: `apps/web/src/modules/agent-messages/markdown-content.tsx`
- Create: `apps/web/src/modules/agent-messages/markdown-content.css`
- Create: `apps/web/src/modules/agent-messages/markdown-content.test.tsx`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Add failing tests for Markdown headings, GFM tables, and raw HTML safety.
- [ ] Run the focused test and verify it fails.
- [ ] Install and assemble `react-markdown` with `remark-gfm`.
- [ ] Run the focused test and verify it passes.

### Task 2: Assistant-only integration and theme

**Files:**
- Modify: `apps/web/src/modules/agent-messages/message-list.tsx`
- Modify: `apps/web/src/modules/agent-messages/message-list.test.tsx`
- Modify: `apps/web/src/app/theme.css`

- [ ] Add failing tests showing assistant Markdown renders while user Markdown
  stays plain text and styles consume theme variables.
- [ ] Run the focused tests and verify they fail.
- [ ] Integrate `MarkdownContent` for assistant text blocks and add light/dark
  theme variables and Markdown styles.
- [ ] Run focused tests and verify they pass.

### Task 3: Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
