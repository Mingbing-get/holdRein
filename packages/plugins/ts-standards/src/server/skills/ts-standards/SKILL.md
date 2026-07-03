---
name: ts-standards
description: Use for TypeScript or JavaScript frontend, backend, and full-stack project changes.
---

# TS Standards

Follow the local project rules first, especially AGENTS.md and package scripts.

Projects must have automated tests unless the user explicitly says tests are not
required. Before changing real implementation code, write or update tests and run
them to observe the expected failure. Tests must cover functionality,
interactions, edge cases, and relevant outcomes. Do not write tests for CSS or
visual styling.

Every file must have one focused responsibility. Organize code with feature
folders and colocated entry points and tests:

```text
dir/index.ts
dir/index.test.ts
dir/index.tsx
dir/index.css
```

Only include the file types the feature needs. When a feature must be split, use
child feature folders rather than accumulating sibling implementation files:

```text
dir/feature-one/index.ts
dir/feature-one/index.test.ts
dir/feature-two/index.ts
dir/feature-two/index.test.ts
```

Small, focused internal implementations such as `helper.ts` may remain standalone
files. Do not create a folder and `index.ts` solely to match this structure.

Export each folder's public API through its `index.ts`. Shared functionality may
be extracted to appropriately scoped common folders such as `utils`,
`components`, `hooks`, `services`, `apis`, or `consts`. Do not create a shared
abstraction until multiple consumers actually need it.

If a file grows too large or mixes responsibilities, split it into child feature
folders while preserving a clear public API.

Keep TypeScript strict. Public types should be explicit. Do not pass Node built-ins such as fs, path, crypto, or process as injectable dependencies.

For frontend work, follow the app's theme system. Prefer existing design tokens and CSS variables over hard-coded colors.

Before claiming completion, run relevant tests, type checks, and lint or other
code-style checks for the changed package or app.
