# Agent Instructions

## Code Quality

- Keep every file at or below 500 lines.
- When a file would exceed 500 lines, split it into a folder and export the
  public API through `index.ts`.
- Use strict TypeScript and keep public types explicit.
- Use ESLint for code quality, Vite for package builds, and Vitest for tests.
- Add or update tests for behavior changes before changing implementation code.

## Frontend Theme And Colors

- Configure Ant Design colors through `ConfigProvider` and enable `theme.cssVar`
  so antd components inherit the active light or dark algorithm.
- Custom application UI must not branch on theme mode to choose color values.
  Define light and dark values in `:root[data-theme-mode="light"]` and
  `:root[data-theme-mode="dark"]`, then consume them through CSS variables.
- Use the `--app-*` variable namespace for application colors and surfaces.
  Components should reference variables such as `var(--app-color-text)`,
  `var(--app-color-bg-container)`, `var(--app-color-primary)`, and
  `var(--app-color-border-secondary)` instead of hard-coded hex, rgb, or rgba
  colors.
- Add new theme colors to the central theme variable file before using them in
  components, and provide values for both light and dark modes.

## Dependency And Runtime Boundaries

- Run pnpm commands through `corepack pnpm` so the project uses the
  `packageManager` version declared in `package.json`.
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
