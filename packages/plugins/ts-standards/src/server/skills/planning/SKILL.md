---
name: planning
description: Use for implementation tasks to decompose work, identify parallelizable subtasks, and choose a verification path before editing code.
---

# Planning

Use this skill before editing code for implementation tasks.

Do not begin implementation until the goal, constraints, and relevant facts are
clear. Inspect the project structure, read the relevant files, and make sure you
understand what the user wants to change, why it matters, and how success should
be verified.

If anything is unclear at the start or becomes unclear while planning or
implementing, stop and ask the user before proceeding. Do not guess about product
requirements, public API behavior, data contracts, persistence rules, security
boundaries, or user-visible design choices when the answer cannot be determined
from the repository.

When more than one design can satisfy the goal, present the viable designs before
implementing. Briefly explain the trade-offs, recommend the best option, and ask
the user to choose. For example:

> I see three workable designs:
>
> 1. Add the behavior inside the existing module.
> 2. Extract a focused helper and call it from the existing module.
> 3. Create a new package-level service.
>
> I recommend option 2 because it keeps the public API stable while making the
> behavior testable. Tell me which design you prefer, and I will continue with
> the implementation.

Only continue to implementation after the facts are clear and, when alternatives
exist, the user has selected or approved a design.

For independent subtasks, use subagents so each worker can focus on a bounded area. Do not introduce git worktrees.

Prefer a short plan that names:

- The target modules or files.
- The tests that should exist or change.
- Work that can run in parallel.
- The verification commands likely needed before completion.
