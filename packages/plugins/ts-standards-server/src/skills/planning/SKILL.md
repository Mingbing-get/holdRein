---
name: planning
description: Use for implementation tasks to decompose work, identify parallelizable subtasks, and choose a verification path before editing code.
---

# Planning

Before editing code, understand the task, inspect the project structure, and decide how to split the work.

For independent subtasks, use subagents so each worker can focus on a bounded area. Do not introduce git worktrees.

Prefer a short plan that names:

- The target modules or files.
- The tests that should exist or change.
- Work that can run in parallel.
- The verification commands likely needed before completion.
