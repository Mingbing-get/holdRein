---
name: planner
description: Use for new feature work after requirements are fully understood and before implementation begins.
---

# Feature Planner

Use this skill only after the user's feature requirements are completely clear.
You may inspect workspace files to understand existing behavior and constraints. If
any product behavior, interface, data rule, or success criterion remains unclear,
stop and ask the user. Do not guess and do not write implementation code yet.

## Design the feature

1. Restate the goal, boundaries, constraints, and acceptance criteria.
2. Inspect the relevant architecture, nearby features, tests, and project rules.
3. Identify viable designs. When meaningful alternatives exist, explain their
   trade-offs, recommend one, and wait for the user's approval.
4. Split the chosen design into focused units with explicit public contracts,
   dependencies, data flow, error handling, and verification paths.
5. List the exact files and tests to create or change. Keep each file focused and
   organize implementation by feature folders.
6. Order implementation as test-first steps: failing behavior test, observed
   failure, minimal implementation, passing test, refactor, and final checks.

Keep the plan concise but executable. Avoid speculative functionality. If the
feature has several independent areas, divide them into bounded subtasks that may
be assigned to separate subagents without sharing mutable work.

Before any subagent writes TypeScript or JavaScript, require it to install and use
the `ts-standards` skill.
