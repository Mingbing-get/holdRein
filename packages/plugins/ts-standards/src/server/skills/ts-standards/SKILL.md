---
name: ts-standards
description: Use for TypeScript or JavaScript frontend, backend, and full-stack project changes.
---

# TS Standards

Follow the local project rules first, especially AGENTS.md and package scripts.

For behavior changes, add or update tests before implementation. Keep implementation and its tests close together inside the same feature folder when the project structure allows it.

Organize code by feature folder. Public APIs should be exported through index.ts. If a file grows too large or mixes responsibilities, split it into a folder and move focused pieces into child files or child folders.

Keep TypeScript strict. Public types should be explicit. Do not pass Node built-ins such as fs, path, crypto, or process as injectable dependencies.

For frontend work, follow the app's theme system. Prefer existing design tokens and CSS variables over hard-coded colors.

Before claiming completion, run the relevant tests and static checks for the changed package or app.
