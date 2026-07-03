# GitHub Plugin Right Panel Design

## Goal

Add Git repository operations to `@hold-rein/plugins-github` through a right
panel and plugin-owned HTTP routes. The panel reports repository state and
supports initialization, local branch switching, commits, and optional pushes.

## User Experience

The panel loads repository state when it mounts. It also refreshes after every
successful mutation and exposes a manual refresh button. It does not poll.

When the workspace is not a Git repository, the panel shows an empty state and
an **Initialize Git** action. Initialization runs `git init`, then reloads the
panel.

For an initialized repository, the panel shows:

- The current branch. Hovering or activating it reveals all other local
  branches. Selecting another branch switches to it only when the worktree has
  no staged, unstaged, or untracked changes.
- The total changed lines as `+<additions> -<deletions>`. The row expands to
  show changed file paths relative to the workspace. It is not expandable when
  there are no changes.
- A commit action enabled only when changes exist. It opens a modal with a
  required commit message and **Commit** and **Commit and Push** buttons.

Buttons display pending state and reject duplicate operations. Successful
operations close the modal where applicable, show feedback, and reload status.
Failures remain visible to the user; commit failures keep the modal and message
intact so the user can retry.

## Architecture

### Server

The plugin registers an Express router under its existing plugin prefix. A
focused Git service uses `simple-git` with the requested workspace as its base
directory. Node built-ins remain internal to the modules that use them.

Routes:

- `GET /status?workspacePath=...` returns repository state.
- `POST /initialize` accepts `{ workspacePath }`.
- `POST /branches/switch` accepts `{ workspacePath, branch }`.
- `POST /commits` accepts `{ workspacePath, message, push }`.

The status response is a discriminated union:

```ts
type GitRepositoryStatus =
  | { initialized: false }
  | {
      initialized: true;
      currentBranch: string;
      branches: readonly string[];
      additions: number;
      deletions: number;
      files: readonly string[];
      hasChanges: boolean;
    };
```

The service derives files and line counts from Git porcelain and numstat data.
Untracked text files contribute their line count to additions. Binary files
appear in the file list but do not contribute to additions or deletions.
Renames appear once using the destination-relative path.

Switching branches checks repository status immediately before checkout and
returns a conflict when any change exists. The server does not rely on the
client's earlier snapshot.

Committing trims and validates a non-empty message, then runs add-all followed
by commit. When `push` is true, it pushes the resulting current branch to
`origin` only after the commit succeeds. Push errors are returned clearly; the
already-created local commit is not rolled back.

Workspace paths are required and validated before Git operations. Git failures
are converted into stable bad-request, conflict, or internal-error responses
without exposing stack traces.

### Web

The web contribution creates one right panel and injects the plugin runtime
request function, following the base plugin's right-panel factory pattern. The
panel receives `workspacePath` through `RightPanelProps`; without one, it shows
an unavailable state and issues no request.

Ant Design supplies the panel controls, branch menu, collapsible file list,
modal, form input, feedback, loading, and empty states. Ant Design colors remain
under `ConfigProvider`; custom styles use centrally defined `--app-*` variables
for both light and dark modes and contain no hard-coded colors.

The UI treats server status as authoritative. It disables branch choices when
changes exist, but the server repeats the guard to handle races. It refreshes
after initialization, switching, committing, or committing and pushing.

## Error Handling

- Missing workspace path: render an unavailable state on the client and reject
  malformed server requests.
- Not a repository: return `{ initialized: false }` from status; mutation routes
  other than initialization reject the request.
- Dirty branch switch: return conflict and preserve the current branch.
- Empty commit message or clean worktree: reject without invoking commit.
- Missing remote, authentication failure, or rejected push: retain the local
  commit and report the push failure.
- Refresh failure: keep the last successful state when available and expose a
  retry action.

## Testing

Tests are added before implementation changes.

Server tests cover repository detection, initialized status, local branches,
staged/unstaged/untracked file aggregation, text and binary line counts,
initialization, dirty-worktree switch rejection, clean switching, message
validation, add/commit ordering, push ordering, and push failure behavior.

Web tests cover the contribution wiring, initial request, missing workspace,
uninitialized state, manual refresh, branch menu and disabled switching,
change expansion, clean-state disabling, required commit messages, both submit
paths, loading states, refresh after success, and visible errors.

The package must pass its Vitest tests, strict TypeScript check, ESLint checks,
and Vite build. Every new or modified source file remains at or below 500 lines.
