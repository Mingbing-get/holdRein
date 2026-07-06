# Plugin Dev Hot Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `hold-rein start --plugin-dev <path>` so local plugin source can run in development mode with Vite-style web HMR and plugin-level server reloads.

**Architecture:** Production plugins keep the existing installed UMD/AMD asset flow. Development plugins are discovered from their fixed package structure: the server entry comes from `exports["./server"].import`, the web entry comes from `exports["./web"].import`, and the dev server port comes from the spawned dev command output. Web entries are served by each plugin's Vite dev server, while host-shared frontend packages are exposed by the main web app through shared ESM shims. Server plugin reloads rebuild the active plugin registry and swap the active plugin router instead of restarting the Hold Rein server.

**Tech Stack:** Strict TypeScript, Node.js child processes and filesystem watchers, Express, Vite dev server, React, Ant Design, Vitest, `corepack pnpm`.

---

## File Structure

- `apps/cli/src/index.ts`: parse repeated `--plugin-dev <path>` options and pass them to the bundled server.
- `apps/cli/src/index.test.ts`: cover CLI parsing, multiple dev plugin paths, and help text.
- `apps/api/src/runtime.ts`: accept dev plugin options and start the dev plugin manager during server startup.
- `apps/api/src/plugin.ts`: support dev plugin manifests, fresh server imports, router rebuilds, and plugin disposal.
- `apps/api/src/plugin.test.ts`: verify reload replaces the registry and active router without accumulating routes.
- `apps/api/src/app.ts`: serve host shared ESM shims for frontend dev plugins.
- `apps/api/src/app.test.ts`: verify shared shim endpoints and plugin asset behavior.
- `apps/api/src/modules/plugins/plugins-service.ts`: merge installed plugin manifests with active dev plugin manifests.
- `apps/api/src/modules/plugins/plugins-service.test.ts`: cover dev manifest inclusion and disabled plugin behavior.
- `packages/plugin-server/src/type.ts`: add `dispose`, dev plugin metadata, and web entry mode fields.
- `packages/plugin-server/src/runtime/dev/index.ts`: create the dev plugin manager.
- `packages/plugin-server/src/runtime/dev/index.test.ts`: test process startup, manifest resolution, debounce reload, and cleanup.
- `packages/plugin-server/src/runtime/loader/index.ts`: import server entries with optional cache busting.
- `packages/plugin-server/src/runtime/loader/index.test.ts`: verify cache-busted imports and dev manifest web URLs.
- `packages/plugin-web/src/type.ts`: add `webEntryType` and dev runtime manifest fields.
- `packages/plugin-web/src/runtime/plugin-loader.ts`: load production UMD entries or development ESM entries.
- `packages/plugin-web/src/runtime/plugin-loader.test.ts`: test both loader paths.
- `apps/web/src/app/runtime-shared.ts`: publish host shared package modules on `globalThis`.
- `apps/web/src/app/runtime-require.ts`: continue registering UMD shared packages and initialize ESM shared globals.
- `apps/web/src/app/app-plugin.tsx`: reload runtime plugin manifests and unload previous dev contributions cleanly.
- `apps/web/src/app/app-plugin.test.tsx`: verify ESM dev plugins load, unregister, and reload without duplicate contributions.
- `packages/plugins/*/vite.web.config.ts`: add shared dev helper usage or documented aliases for host shared packages.

## Runtime Model

Production plugin manifest:

```ts
{
  id: "github",
  packageName: "@hold-rein/plugin-github",
  webEntry: "/plugin-assets/%40hold-rein__plugin-github/web.umd.cjs",
  webEntryType: "umd"
}
```

Development plugin manifest:

```ts
{
  dev: true,
  id: "github",
  packageName: "@hold-rein/plugin-github",
  webEntry: "http://127.0.0.1:5178/src/web.ts",
  webEntryType: "module"
}
```

The dev manager derives this URL from `package.json` instead of a custom `holdRein` block:

```ts
const webEntryPath = packageJson.exports["./web"].import;
const webEntry = new URL(webEntryPath, devServerOrigin).href;
```

The frontend loader keeps the current UMD path for installed plugins. It adds a development branch that uses native dynamic import for ESM entries:

```ts
if (manifest.webEntryType === "module") {
  const module = await import(/* @vite-ignore */ manifest.webEntry);
  return module.default;
}
```

Host shared frontend packages are exported once by the main app and consumed by plugin dev servers through aliases. This avoids duplicate React, duplicate Ant Design context, and duplicate `@hold-rein/plugin-web` registries.

## Shared Frontend Packages

Host app initializes:

```ts
globalThis.__HOLD_REIN_SHARED__ = {
  antd: Antd,
  icons: AntDesignIcons,
  monaco: MonacoEditor,
  monacoReact: MonacoEditorReact,
  pluginWeb: HoldReinPluginWeb,
  react: React,
  reactDom: ReactDom,
  reactJsxRuntime: ReactJsxRuntime
};
```

The API serves ESM shims such as `/host-shared/react.js`:

```ts
const React = globalThis.__HOLD_REIN_SHARED__.react;
export default React;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useState = React.useState;
```

Plugin Vite dev config aliases host-shared packages:

```ts
resolve: {
  alias: {
    "@hold-rein/plugin-web": "http://127.0.0.1:3001/host-shared/plugin-web.js",
    "antd": "http://127.0.0.1:3001/host-shared/antd.js",
    "react": "http://127.0.0.1:3001/host-shared/react.js",
    "react-dom": "http://127.0.0.1:3001/host-shared/react-dom.js",
    "react/jsx-runtime": "http://127.0.0.1:3001/host-shared/react-jsx-runtime.js"
  }
}
```

## Server Reload Model

The Express app keeps one stable `/plugin` mount. Reloading plugins rebuilds a new `Router`, registers current plugin routes on that router, and swaps `activePluginRouter`. Old routers are not mutated; they naturally fall out of use after in-flight requests finish.

Server plugins gain an optional lifecycle hook:

```ts
interface Plugin {
  readonly id: string;
  readonly dispose?: () => void | Promise<void>;
  readonly registerRoutes?: (context: RouteContext) => Router | Promise<Router>;
}
```

Reload order:

1. Call `dispose()` for replaced dev plugin instances.
2. Import the changed server entry with a cache-busting URL.
3. Replace the plugin registry.
4. Rebuild and swap the active plugin router.
5. Keep installed plugins active unless disabled.

---

### Task 1: Add CLI Dev Plugin Options

**Files:**
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Add tests for:

```ts
await runCli(["start", "--plugin-dev", "../plugin-a", "--plugin-dev", "../plugin-b"], options);
```

Expected `startRunServer` receives:

```ts
{
  devPluginPaths: ["../plugin-a", "../plugin-b"],
  host: "127.0.0.1",
  port: 3001,
  write: output.write
}
```

- [ ] **Step 2: Run failing test**

Run: `corepack pnpm exec vitest run apps/cli/src/index.test.ts`
Expected: FAIL because `devPluginPaths` is not parsed or passed through.

- [ ] **Step 3: Implement option parsing**

Add `devPluginPaths` to `RunServerOptions`. Parse repeated `--plugin-dev` values in `parseRunOptions`. Update help text with:

```text
start --plugin-dev <path>  Load a local plugin source in development mode
```

- [ ] **Step 4: Verify**

Run: `corepack pnpm exec vitest run apps/cli/src/index.test.ts`
Expected: PASS.

### Task 2: Define Dev Runtime Contracts

**Files:**
- Modify: `packages/plugin-server/src/type.ts`
- Modify: `packages/plugin-web/src/type.ts`
- Modify: `packages/plugin-server/src/index.ts`
- Modify: `packages/plugin-web/src/index.ts`

- [ ] **Step 1: Write failing type/export tests**

Add tests that construct a runtime web manifest with:

```ts
{
  dev: true,
  id: "demo",
  name: "Demo",
  packageName: "@scope/demo",
  version: "0.0.0",
  webEntry: "http://127.0.0.1:5178/src/web.ts",
  webEntryType: "module"
}
```

Add a server plugin fixture with `dispose()`.

- [ ] **Step 2: Run failing tests**

Run: `corepack pnpm exec vitest run packages/plugin-server/src/index.test.ts packages/plugin-web/src/index.test.ts`
Expected: FAIL because the new fields are not typed/exported.

- [ ] **Step 3: Add explicit public contracts**

Add:

```ts
export type RuntimeWebEntryType = "umd" | "module";
```

Extend `RuntimePluginManifest` with:

```ts
readonly dev?: boolean;
readonly webEntryType?: RuntimeWebEntryType;
```

Extend `ServerPlugin.Plugin` with optional `dispose`.

- [ ] **Step 4: Verify**

Run: `corepack pnpm exec vitest run packages/plugin-server/src/index.test.ts packages/plugin-web/src/index.test.ts`
Expected: PASS.

### Task 3: Load ESM Web Plugins In Development

**Files:**
- Modify: `packages/plugin-web/src/runtime/plugin-loader.ts`
- Modify: `packages/plugin-web/src/runtime/plugin-loader.test.ts`

- [ ] **Step 1: Write failing loader tests**

Test that `webEntryType: "module"` calls a module importer and registers the default plugin. Test that missing `webEntryType` or `"umd"` keeps the current `require` loader path.

- [ ] **Step 2: Run failing test**

Run: `corepack pnpm exec vitest run packages/plugin-web/src/runtime/plugin-loader.test.ts`
Expected: FAIL because only the UMD loader exists.

- [ ] **Step 3: Implement dual loader path**

Add an optional `moduleImporter` test seam and implement:

```ts
const module = await moduleImporter(manifest.webEntry);
const plugin = module.default;
```

Keep style loading for both modes, but skip duplicate style links by absolute URL.

- [ ] **Step 4: Verify**

Run: `corepack pnpm exec vitest run packages/plugin-web/src/runtime/plugin-loader.test.ts`
Expected: PASS.

### Task 4: Expose Host Shared ESM Modules

**Files:**
- Create: `apps/web/src/app/runtime-shared.ts`
- Modify: `apps/web/src/app/runtime-require.ts`
- Modify: `apps/web/src/app/runtime-require.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Write failing tests for shared globals**

Verify `registerRuntimePluginPackages()` also initializes `globalThis.__HOLD_REIN_SHARED__` with React, Ant Design, Monaco, and plugin-web references.

- [ ] **Step 2: Write failing API tests for shim routes**

Verify `GET /host-shared/react.js` returns JavaScript containing `__HOLD_REIN_SHARED__.react` and named exports used by plugin code.

- [ ] **Step 3: Run failing tests**

Run: `corepack pnpm exec vitest run apps/web/src/app/runtime-require.test.ts apps/api/src/app.test.ts`
Expected: FAIL because shared globals and shim endpoints do not exist.

- [ ] **Step 4: Implement shared globals**

Create `runtime-shared.ts` with a typed `registerRuntimeSharedPackages()` function. Call it from `registerRuntimePluginPackages()`.

- [ ] **Step 5: Implement shared shim endpoints**

Add an Express route before static web assets:

```ts
app.get("/host-shared/:moduleName", createHostSharedModuleHandler());
```

Return small static ESM snippets for the allowlisted module names only. Reject unknown modules with 404.

- [ ] **Step 6: Verify**

Run: `corepack pnpm exec vitest run apps/web/src/app/runtime-require.test.ts apps/api/src/app.test.ts`
Expected: PASS.

### Task 5: Add Dev Plugin Manager

**Files:**
- Create: `packages/plugin-server/src/runtime/dev/index.ts`
- Create: `packages/plugin-server/src/runtime/dev/index.test.ts`
- Modify: `packages/plugin-server/src/index.ts`

- [ ] **Step 1: Write failing tests for dev process startup**

Test that a plugin with `scripts.dev` starts `corepack pnpm dev` in the plugin directory. If a first-party plugin has no `dev` script yet, the implementation may add a standard script that runs Vite for the fixed plugin structure.

- [ ] **Step 2: Write failing tests for manifest resolution**

Test reading package metadata and returning a dev manifest with `webEntryType: "module"`. The manager must derive the entry from package exports and the dev server port:

```ts
expect(manifest.webEntry).toBe("http://127.0.0.1:5178/src/web.ts");
```

- [ ] **Step 3: Write failing tests for watcher reload**

Use fake timers or injected watcher callbacks to verify multiple rapid file changes trigger one debounced reload. Add a test that parses a Vite local URL from dev command stdout and stores the detected port.

- [ ] **Step 4: Run failing tests**

Run: `corepack pnpm exec vitest run packages/plugin-server/src/runtime/dev/index.test.ts`
Expected: FAIL because the dev manager does not exist.

- [ ] **Step 5: Implement the dev manager**

Responsibilities:

- Resolve each `--plugin-dev` path.
- Read plugin package metadata.
- Start the package `dev` command with `corepack pnpm`.
- Parse the Vite local URL from stdout to discover the chosen port.
- Derive web entries from `exports["./web"].import`.
- Derive server entries from `exports["./server"].import`.
- Watch server-relevant files.
- Debounce reload callbacks.
- Track child processes and close them on server shutdown.

- [ ] **Step 6: Verify**

Run: `corepack pnpm exec vitest run packages/plugin-server/src/runtime/dev/index.test.ts`
Expected: PASS.

### Task 6: Import Server Plugins Fresh And Dispose Old Instances

**Files:**
- Modify: `packages/plugin-server/src/runtime/loader/index.ts`
- Modify: `packages/plugin-server/src/runtime/loader/index.test.ts`
- Modify: `apps/api/src/plugin.ts`
- Modify: `apps/api/src/plugin.test.ts`

- [ ] **Step 1: Write failing cache-busting loader tests**

Verify dev plugin imports call `toImportUrl(entryPath, version)` or append a reload token such as `?holdReinReload=2`.

- [ ] **Step 2: Write failing disposal tests**

Verify `reloadServerPlugins()` calls `dispose()` on replaced dev plugin instances before replacing the registry.

- [ ] **Step 3: Write failing router replacement tests**

Register one route, reload with a different route, and verify requests through the stable handler use the new router without calling the old route.

- [ ] **Step 4: Run failing tests**

Run: `corepack pnpm exec vitest run packages/plugin-server/src/runtime/loader/index.test.ts apps/api/src/plugin.test.ts`
Expected: FAIL because imports are cached and dispose is not called.

- [ ] **Step 5: Implement fresh import support**

Add an optional import version or cache-busting callback to loader options. Apply it only for dev plugin entries.

- [ ] **Step 6: Implement disposal and router rebuild**

Keep a map of active plugin instances by package or id. On reload, call `dispose()` for replaced dev plugins. Preserve the current `activePluginRouter` swap pattern.

- [ ] **Step 7: Verify**

Run: `corepack pnpm exec vitest run packages/plugin-server/src/runtime/loader/index.test.ts apps/api/src/plugin.test.ts`
Expected: PASS.

### Task 7: Merge Installed And Dev Plugin Manifests

**Files:**
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/modules/plugins/plugins-service.ts`
- Modify: `apps/api/src/modules/plugins/plugins-service.test.ts`
- Modify: `apps/api/src/modules/plugins/plugins-router.test.ts`

- [ ] **Step 1: Write failing API tests**

Verify `GET /api/v1/plugins` returns installed manifests plus active dev manifests. Verify disabled plugin ids still hide matching dev plugins.

- [ ] **Step 2: Run failing tests**

Run: `corepack pnpm exec vitest run apps/api/src/modules/plugins/plugins-service.test.ts apps/api/src/modules/plugins/plugins-router.test.ts`
Expected: FAIL because the service only reads installed plugin manifests.

- [ ] **Step 3: Implement dev manifest provider**

Expose active dev manifests from the dev manager or `plugin.ts`. Merge them after installed manifests so dev plugin entries override matching installed package ids.

- [ ] **Step 4: Wire runtime startup**

Pass `devPluginPaths` from `startHoldReinServer()` into the dev manager. Start the manager before the first plugin bootstrap so dev plugins appear in the initial `/api/v1/plugins` response.

- [ ] **Step 5: Verify**

Run: `corepack pnpm exec vitest run apps/api/src/modules/plugins/plugins-service.test.ts apps/api/src/modules/plugins/plugins-router.test.ts apps/api/src/runtime.test.ts`
Expected: PASS.

### Task 8: Document Plugin Dev Conventions

**Files:**
- Modify: `README.md`
- Modify: `packages/plugins/github/package.json`
- Modify: `packages/plugins/base/package.json`
- Modify: `packages/plugins/code/package.json`
- Modify: `packages/plugins/memory/package.json`
- Modify: `packages/plugins/ts-standards/package.json`
- Modify: `packages/plugins/github/vite.web.config.ts`
- Modify: `packages/plugins/base/vite.web.config.ts`
- Modify: `packages/plugins/code/vite.web.config.ts`
- Modify: `packages/plugins/memory/vite.web.config.ts`
- Modify: `packages/plugins/ts-standards/vite.web.config.ts`

- [ ] **Step 1: Add docs for startup**

Document:

```bash
hold-rein start --plugin-dev ./packages/plugins/github
```

Document the fixed convention:

- `package.json` must expose `./server.import` and `./web.import`.
- `package.json` should provide a `dev` script that starts the plugin Vite dev server.
- The CLI discovers the dev server port from stdout and builds the web entry URL from `exports["./web"].import`.

- [ ] **Step 2: Add docs for shared package aliases**

Show plugin authors how to alias host-shared React, Ant Design, and `@hold-rein/plugin-web` during development.

- [ ] **Step 3: Update first-party plugin configs**

Add the shared alias helper or explicit aliases to first-party plugin web Vite configs.

- [ ] **Step 4: Verify docs and configs**

Run: `corepack pnpm exec vitest run packages/plugins/github/src/web/git-panel/git-panel.test.ts`
Expected: PASS.

### Task 9: Full Verification

**Files:**
- No production file changes unless failures reveal missing integration.

- [ ] **Step 1: Run focused test suites**

Run: `corepack pnpm exec vitest run apps/cli/src/index.test.ts packages/plugin-web/src/runtime/plugin-loader.test.ts packages/plugin-server/src/runtime/dev/index.test.ts apps/api/src/plugin.test.ts apps/web/src/app/app-plugin.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run affected package type checks**

Run `corepack pnpm --filter <package> typecheck` for `@hold-rein/cli`, `@hold-rein/api`, `@hold-rein/plugin-server`, `@hold-rein/plugin-web`, and `@hold-rein/web`.
Expected: PASS for each package.

- [ ] **Step 3: Check file length limit**

Run: `wc -l apps/cli/src/index.ts apps/api/src/plugin.ts apps/web/src/app/app-plugin.tsx packages/plugin-web/src/type.ts packages/plugin-server/src/type.ts`
Expected: every file stays at or below 500 lines. Split files before merging if any file exceeds the limit.

- [ ] **Step 4: Manual development smoke test**

Run: `corepack pnpm --filter @hold-rein/cli build`, then `hold-rein start --plugin-dev ./packages/plugins/github`.
Expected: the app starts, the GitHub plugin loads from a dev ESM manifest, web edits trigger Vite HMR, server edits reload plugin routes, and the browser console has no duplicate React errors.
