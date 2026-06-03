# Agent Instructions

## Code Quality

- Keep every file at or below 500 lines.
- When a file would exceed 500 lines, split it into a folder and export the
  public API through `index.ts`.
- Use strict TypeScript and keep public types explicit.
- Use ESLint for code quality, Vite for package builds, and Vitest for tests.
- Add or update tests for behavior changes before changing implementation code.

## Dependency And Runtime Boundaries

- Do not pass Node built-in capabilities such as `fs`, `path`, `crypto`, or
  `process` through function parameters as injectable dependencies.
- Use Node built-ins directly inside the module that needs them.
- External services, SDK clients, and project-specific adapters may be passed
  through explicit options when that is part of the public runtime contract.

## Publishing

- Use Changesets for multi-package npm releases.
- Publishable packages must include `exports`, `types`, `files`, and
  `publishConfig`.
- Build artifacts belong in `dist` and should not be committed.
