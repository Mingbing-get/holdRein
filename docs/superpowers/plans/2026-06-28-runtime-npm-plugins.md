# Runtime NPM Plugins Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Add runtime npm plugins with server and web entries, while all host-shared dependencies come from the packaged application.
**Architecture:** npm packages are downloaded into a temporary install directory, then the resolved plugin package directory is copied into `plugins/<encoded-package-name>`. Runtime discovery scans direct plugin directories, while `plugins/node_modules` is reserved only for host-managed shared dependency symlinks. Server plugins keep `export default plugin`; web plugins are served as ESM assets and resolve externalized dependencies through host-provided shared ESM URLs and a generated import map.
**Tech Stack:** TypeScript, Node ESM dynamic import, Express, Vite library mode, React, Ant Design, Monaco, Vitest.
---
## File Structure
- `packages/plugin-server/src/type.ts`: add package manifest types.
- `packages/plugin-server/src/runtime/shared-packages.ts`: server shared package allowlist.
- `packages/plugin-server/src/runtime/plugin-manifest.ts`: manifest parser and discovery.
- `packages/plugin-server/src/runtime/plugin-installer.ts`: install npm packages in a temp directory and copy plugin directories into the plugin root.
- `packages/plugin-server/src/runtime/shared-symlinks.ts`: symlink host shared packages into plugin root.
- `packages/plugin-server/src/runtime/plugin-loader.ts`: link shared deps, import server entries, return registered web manifests.
- `packages/plugin-server/src/index.ts`: export new runtime helpers.
- `packages/plugin-web/src/type.ts`: add runtime web manifest and shared module map types.
- `packages/plugin-web/src/runtime/shared-packages.ts`: web shared package allowlist.
- `packages/plugin-web/src/runtime/import-map.ts`: filter shared import mappings.
- `packages/plugin-web/src/runtime/plugin-loader.ts`: dynamic import and register web plugin entries.
- `packages/plugin-web/src/index.ts`: export web runtime helpers.
- `apps/api/src/config/env.ts`: add `HOLD_REIN_PLUGIN_ROOT`.
- `apps/api/src/plugin.ts`: bootstrap built-in and installed server plugins.
- `apps/api/src/modules/plugins/plugins-router.ts`: expose runtime plugin metadata and shared URLs.
- `apps/api/src/app.ts`: mount plugin metadata and asset routes.
- `apps/api/src/server.ts`: call plugin bootstrap before app creation.
- `apps/web/src/app/app-plugin.tsx`: fetch runtime plugin metadata and register web plugins.
- `packages/plugins/*/package.json`: move host-shared packages to `peerDependencies` and keep build copies in `devDependencies`.
- `packages/plugins/*/vite.config.ts`: externalize host-shared packages.
## Shared Packages
Server:
```ts
export const SERVER_PLUGIN_SHARED_PACKAGES = [
  "@hold-rein/plugin-server",
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "express"
] as const;
```
Web:
```ts
export const WEB_PLUGIN_SHARED_PACKAGES = [
  "@hold-rein/plugin-web",
  "react",
  "react-dom",
  "react/jsx-runtime",
  "antd",
  "@ant-design/icons",
  "@monaco-editor/react",
  "monaco-editor"
] as const;
```
### Task 1: Add Public Runtime Contracts
**Files:**
- Modify: `packages/plugin-server/src/type.ts`
- Modify: `packages/plugin-server/src/index.ts`
- Create: `packages/plugin-server/src/runtime/shared-packages.ts`
- Modify: `packages/plugin-web/src/type.ts`
- Modify: `packages/plugin-web/src/index.ts`
- Create: `packages/plugin-web/src/runtime/shared-packages.ts`
- Test: `packages/plugin-server/src/index.test.ts`
- Test: `packages/plugin-web/src/index.test.ts`
- [ ] **Step 1: Write failing export tests**
Add to `packages/plugin-server/src/index.test.ts`:
```ts
import { SERVER_PLUGIN_SHARED_PACKAGES } from "./index";
it("exports server shared packages", () => {
  expect(SERVER_PLUGIN_SHARED_PACKAGES).toEqual([
    "@hold-rein/plugin-server",
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "express"
  ]);
});
```
Add to `packages/plugin-web/src/index.test.ts`:
```ts
import { WEB_PLUGIN_SHARED_PACKAGES } from "./index";
it("exports web shared packages", () => {
  expect(WEB_PLUGIN_SHARED_PACKAGES).toEqual([
    "@hold-rein/plugin-web",
    "react",
    "react-dom",
    "react/jsx-runtime",
    "antd",
    "@ant-design/icons",
    "@monaco-editor/react",
    "monaco-editor"
  ]);
});
```
- [ ] **Step 2: Run failing tests**
Run: `pnpm exec vitest run packages/plugin-server/src/index.test.ts packages/plugin-web/src/index.test.ts`
Expected: FAIL because the constants are not exported.
- [ ] **Step 3: Add shared package constants and manifest types**
Create the two `shared-packages.ts` files using the constants shown in “Shared Packages”. Add these types:
```ts
export interface PackageEntryManifest {
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly serverEntry: string;
  readonly webEntry?: string;
  readonly compatibleHost?: string;
}
export interface RuntimePluginManifest {
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly webEntry: string;
}
export interface SharedModuleMap {
  readonly imports: Readonly<Record<string, string>>;
}
```
- [ ] **Step 4: Export from SDK entrypoints**
Export constants and types from both `index.ts` files:
```ts
export { SERVER_PLUGIN_SHARED_PACKAGES } from "./runtime/shared-packages";
export { WEB_PLUGIN_SHARED_PACKAGES } from "./runtime/shared-packages";
```
- [ ] **Step 5: Verify**
Run: `pnpm exec vitest run packages/plugin-server/src/index.test.ts packages/plugin-web/src/index.test.ts`
Expected: PASS.
### Task 2: Validate And Discover Plugin Manifests
**Files:**
- Create: `packages/plugin-server/src/runtime/plugin-manifest.ts`
- Create: `packages/plugin-server/src/runtime/plugin-manifest.test.ts`
- Modify: `packages/plugin-server/src/index.ts`
- [ ] **Step 1: Write failing tests**
Create `plugin-manifest.test.ts`:
```ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverServerPluginManifests, parseServerPluginManifest } from "./plugin-manifest";
describe("plugin manifests", () => {
  it("accepts valid manifests", () => {
    expect(parseServerPluginManifest({
      id: "demo",
      name: "Demo",
      packageName: "@scope/demo",
      version: "1.0.0",
      serverEntry: "./server/index.js",
      webEntry: "./web/index.js"
    }).id).toBe("demo");
  });
  it("rejects missing server entries", () => {
    expect(() => parseServerPluginManifest({
      id: "demo",
      name: "Demo",
      packageName: "@scope/demo",
      version: "1.0.0"
    })).toThrow('Plugin manifest "serverEntry" must be a string.');
  });
  it("discovers direct plugin directory manifests", async () => {
    const root = await mkdtemp(join(tmpdir(), "hold-rein-plugin-"));
    const dir = join(root, "@scope__demo", "dist");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "manifest.json"), "{}");
    await expect(discoverServerPluginManifests(root)).resolves.toEqual([
      join(dir, "manifest.json")
    ]);
  });
});
```
- [ ] **Step 2: Run failing test**
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/plugin-manifest.test.ts`
Expected: FAIL because the module does not exist.
- [ ] **Step 3: Implement parser and discovery**
Implement `parseServerPluginManifest(input)` with strict string validation for `id`, `name`, `packageName`, `version`, and `serverEntry`. Implement `discoverServerPluginManifests(pluginRoot)` by reading direct child directories under `pluginRoot`, skipping `node_modules`, and returning existing paths ending in `dist/manifest.json`.
Use this core shape:
```ts
export async function discoverServerPluginManifests(pluginRoot: string): Promise<string[]> {
  const entries = await readdir(pluginRoot, { withFileTypes: true }).catch(() => []);
  const manifests: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    manifests.push(join(pluginRoot, entry.name, "dist", "manifest.json"));
  }
  return existingFiles(manifests);
}
```
- [ ] **Step 4: Export helpers and verify**
Export `parseServerPluginManifest` and `discoverServerPluginManifests` from `packages/plugin-server/src/index.ts`.
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/plugin-manifest.test.ts`
Expected: PASS.
### Task 3: Install NPM Plugins Through A Temporary Directory
**Files:**
- Create: `packages/plugin-server/src/runtime/plugin-installer.ts`
- Create: `packages/plugin-server/src/runtime/plugin-installer.test.ts`
- Modify: `packages/plugin-server/src/index.ts`
- [ ] **Step 1: Write failing installer tests**
Create `plugin-installer.test.ts`:
```ts
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { copyInstalledPluginPackage, encodePluginDirectoryName } from "./plugin-installer";
it("encodes package names into stable plugin directory names", () => {
  expect(encodePluginDirectoryName("@scope/demo")).toBe("@scope__demo");
  expect(encodePluginDirectoryName("plain-demo")).toBe("plain-demo");
});
it("copies a resolved package directory into the plugin root", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-install-"));
  const source = join(root, "tmp", "node_modules", "@scope", "demo");
  await mkdir(join(source, "dist"), { recursive: true });
  await writeFile(join(source, "dist", "manifest.json"), "{}");
  const destination = await copyInstalledPluginPackage({
    packageName: "@scope/demo",
    pluginRoot: join(root, "plugins"),
    sourcePackageDir: source
  });
  expect(destination).toBe(join(root, "plugins", "@scope__demo"));
  await expect(readFile(join(destination, "dist", "manifest.json"), "utf8")).resolves.toBe("{}");
});
```
- [ ] **Step 2: Implement installer helpers**
Implement `encodePluginDirectoryName(packageName)` by replacing `/` with `__`. Implement `copyInstalledPluginPackage({ packageName, pluginRoot, sourcePackageDir })` by removing the destination and copying the source package directory recursively into `pluginRoot/<encoded-package-name>`. Implement `installNpmPluginPackage({ packageName, pluginRoot, tempRoot })` by creating a temp project, writing a minimal `package.json`, running `npm install <packageName> --ignore-scripts`, resolving the installed package under the temp `node_modules`, then calling `copyInstalledPluginPackage`. Keep copy as the shared primitive so future installers can copy from tarballs, marketplaces, or local directories without changing runtime loading.
- [ ] **Step 3: Export and verify**
Export installer helpers from `packages/plugin-server/src/index.ts`.
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/plugin-installer.test.ts packages/plugin-server/src/runtime/plugin-manifest.test.ts`
Expected: PASS.
### Task 4: Symlink Host Shared Dependencies Into Plugin Root
**Files:**
- Create: `packages/plugin-server/src/runtime/shared-symlinks.ts`
- Create: `packages/plugin-server/src/runtime/shared-symlinks.test.ts`
- Modify: `packages/plugin-server/src/index.ts`
- [ ] **Step 1: Write failing tests**
Create `shared-symlinks.test.ts`:
```ts
import { mkdtemp, readlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { linkServerPluginSharedPackages } from "./shared-symlinks";
it("creates shared package symlinks in plugin node_modules", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-link-"));
  await linkServerPluginSharedPackages({
    hostNodeModules: join(root, "host", "node_modules"),
    packages: ["@scope/shared", "express"],
    pluginRoot: join(root, "plugins")
  });
  expect((await stat(join(root, "plugins", "node_modules", "@scope", "shared"))).isSymbolicLink()).toBe(true);
  expect(await readlink(join(root, "plugins", "node_modules", "express"))).toBe(join(root, "host", "node_modules", "express"));
});
```
- [ ] **Step 2: Run failing test**
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/shared-symlinks.test.ts`
Expected: FAIL because the module does not exist.
- [ ] **Step 3: Implement symlink helper**
Implement:
```ts
export interface LinkServerPluginSharedPackagesOptions {
  readonly hostNodeModules: string;
  readonly packages?: readonly string[];
  readonly pluginRoot: string;
}
export async function linkServerPluginSharedPackages(options: LinkServerPluginSharedPackagesOptions): Promise<void> {
  for (const packageName of options.packages ?? SERVER_PLUGIN_SHARED_PACKAGES) {
    const linkPath = join(options.pluginRoot, "node_modules", ...packageName.split("/"));
    const targetPath = join(options.hostNodeModules, ...packageName.split("/"));
    await mkdir(dirname(linkPath), { recursive: true });
    await rm(linkPath, { force: true, recursive: true });
    await symlink(targetPath, linkPath, "junction");
  }
}
```
- [ ] **Step 4: Export and verify**
Export `linkServerPluginSharedPackages` from `packages/plugin-server/src/index.ts`.
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/shared-symlinks.test.ts`
Expected: PASS.
### Task 5: Load Installed Server Plugins
**Files:**
- Create: `packages/plugin-server/src/runtime/plugin-loader.ts`
- Create: `packages/plugin-server/src/runtime/plugin-loader.test.ts`
- Modify: `packages/plugin-server/src/index.ts`
- [ ] **Step 1: Write failing loader test**
Create `plugin-loader.test.ts`:
```ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { loadInstalledServerPlugins } from "./plugin-loader";
it("imports plugin default exports and returns web manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "hold-rein-load-"));
  const dir = join(root, "@scope__demo", "dist");
  await mkdir(join(dir, "server"), { recursive: true });
  await writeFile(join(dir, "server", "index.js"), 'export default { id: "demo" };');
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    id: "demo",
    name: "Demo",
    packageName: "@scope/demo",
    version: "1.0.0",
    serverEntry: "./server/index.js",
    webEntry: "./web/index.js"
  }));
  const result = await loadInstalledServerPlugins({
    hostNodeModules: join(root, "host", "node_modules"),
    pluginRoot: root,
    toImportUrl: (path) => pathToFileURL(path).href
  });
  expect(result.plugins).toEqual([{ id: "demo" }]);
  expect(result.webPlugins[0]).toEqual({
    id: "demo",
    name: "Demo",
    packageName: "@scope/demo",
    version: "1.0.0",
    webEntry: "/plugin-assets/%40scope__demo/web/index.js"
  });
});
```
- [ ] **Step 2: Run failing test**
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/plugin-loader.test.ts`
Expected: FAIL because the loader does not exist.
- [ ] **Step 3: Implement loader**
Implement:
```ts
export interface LoadedServerPlugins {
  readonly plugins: ServerPlugin.Plugin[];
  readonly webPlugins: WebRuntimePluginManifest[];
}
export interface WebRuntimePluginManifest {
  readonly id: string; readonly name: string; readonly packageName: string; readonly version: string; readonly webEntry: string;
}
export async function loadInstalledServerPlugins(options: LoadInstalledServerPluginsOptions): Promise<LoadedServerPlugins> {
  await linkServerPluginSharedPackages({
    hostNodeModules: options.hostNodeModules,
    pluginRoot: options.pluginRoot
  });
  const manifests = await discoverServerPluginManifests(options.pluginRoot);
  const plugins: ServerPlugin.Plugin[] = [];
  const webPlugins: WebRuntimePluginManifest[] = [];
  for (const manifestPath of manifests) {
    const manifest = parseServerPluginManifest(JSON.parse(await readFile(manifestPath, "utf8")));
    const entryPath = resolve(dirname(manifestPath), manifest.serverEntry);
    const module = await import((options.toImportUrl ?? pathToFileURL)(entryPath));
    if (!module.default) throw new Error(`Plugin "${manifest.id}" does not export a default plugin.`);
    plugins.push(module.default);
    if (manifest.webEntry) {
      const pluginDir = basename(resolve(dirname(manifestPath), ".."));
      webPlugins.push({
        id: manifest.id,
        name: manifest.name,
        packageName: manifest.packageName,
        version: manifest.version,
        webEntry: `/plugin-assets/${encodeURIComponent(pluginDir)}/${manifest.webEntry.replace(/^\.\//, "")}`
      });
    }
  }
  return { plugins, webPlugins };
}
```
- [ ] **Step 4: Export and verify**
Export `loadInstalledServerPlugins` and related types from `packages/plugin-server/src/index.ts`.
Run: `pnpm exec vitest run packages/plugin-server/src/runtime/plugin-loader.test.ts`
Expected: PASS.
### Task 6: Expose Plugin Metadata From API
**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/plugin.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/modules/plugins/plugins-router.ts`
- Create: `apps/api/src/modules/plugins/plugins-router.test.ts`
- [ ] **Step 1: Write failing router test**
Create `plugins-router.test.ts`:
```ts
import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { createPluginsRouter } from "./plugins-router";
it("returns runtime plugin config", async () => {
  const app = express();
  app.use("/api/v1/plugins", createPluginsRouter({
    plugins: [{ id: "demo", name: "Demo", packageName: "@scope/demo", version: "1.0.0", webEntry: "/plugin-assets/demo.js" }],
    sharedImports: { react: "/shared/react.js" }
  }));
  const response = await request(app).get("/api/v1/plugins");
  expect(response.status).toBe(200);
  expect(response.body.data.sharedImports.react).toBe("/shared/react.js");
});
```
- [ ] **Step 2: Implement API router and bootstrap**
Implement `createPluginsRouter({ plugins, sharedImports })` with `GET /` returning `sendSuccess(response, { plugins, sharedImports })`. Add `pluginRoot` to API env using `HOLD_REIN_PLUGIN_ROOT ?? join(process.cwd(), ".hold-rein", "plugins")`. Add `bootstrapServerPlugins(pluginRoot)` in `apps/api/src/plugin.ts` to register built-ins, call `loadInstalledServerPlugins`, register each loaded server plugin, and store web manifests for the router.
- [ ] **Step 3: Wire app and server**
Mount `/api/v1/plugins` in `apps/api/src/app.ts`. In `apps/api/src/server.ts`, call `await bootstrapServerPlugins(env.pluginRoot)` before `createApp()`.
- [ ] **Step 4: Verify**
Run: `pnpm --filter @hold-rein/api exec vitest run apps/api/src/modules/plugins/plugins-router.test.ts apps/api/src/app.test.ts`
Expected: PASS.
### Task 7: Add Web Import Map And Runtime Loader
**Files:**
- Create: `packages/plugin-web/src/runtime/import-map.ts`
- Create: `packages/plugin-web/src/runtime/import-map.test.ts`
- Create: `packages/plugin-web/src/runtime/plugin-loader.ts`
- Create: `packages/plugin-web/src/runtime/plugin-loader.test.ts`
- Modify: `packages/plugin-web/src/index.ts`
- [ ] **Step 1: Write failing tests**
Create import map and loader tests:
```ts
import { expect, it, vi } from "vitest";
import { createPluginImportMap } from "./import-map";
import { loadRuntimeWebPlugins } from "./plugin-loader";
it("filters shared imports", () => {
  expect(createPluginImportMap({ react: "/react.js", unknown: "/x.js" })).toEqual({
    imports: { react: "/react.js" }
  });
});
it("imports and registers web plugins", async () => {
  const register = vi.fn();
  await loadRuntimeWebPlugins({
    importer: vi.fn(async () => ({ default: { id: "demo" } })),
    manifests: [{ id: "demo", name: "Demo", packageName: "@scope/demo", version: "1.0.0", webEntry: "/demo.js" }],
    registry: { has: () => false, register }
  });
  expect(register).toHaveBeenCalledWith({ id: "demo" });
});
```
- [ ] **Step 2: Implement web helpers**
`createPluginImportMap` returns only entries whose keys exist in `WEB_PLUGIN_SHARED_PACKAGES`. `loadRuntimeWebPlugins` loops manifests, skips registered ids, imports each `webEntry` with `import(/* @vite-ignore */ entryUrl)`, validates `default`, and registers it.
- [ ] **Step 3: Export and verify**
Export web helpers from `packages/plugin-web/src/index.ts`.
Run: `pnpm exec vitest run packages/plugin-web/src/runtime/import-map.test.ts packages/plugin-web/src/runtime/plugin-loader.test.ts`
Expected: PASS.
### Task 8: Register Runtime Web Plugins In The App
**Files:**
- Modify: `apps/web/src/app/app-plugin.tsx`
- Create: `apps/web/src/app/runtime-plugin-loader.test.tsx`
- [ ] **Step 1: Write failing integration test**
Create a test that stubs the request to `/plugins`, injects `runtimePluginImporter`, renders `AppPluginProvider`, and asserts a setting contributed by the runtime plugin appears.
```tsx
const runtimePlugin = {
  id: "runtime",
  contributionResolver: {
    settings: [{ id: "settings", title: "Runtime Settings", Render: () => null }]
  }
};
```
- [ ] **Step 2: Implement provider loading**
Add optional `runtimePluginImporter` prop for tests. After registering `baseWebPlugin`, call `request({ path: "/plugins", method: "GET" })`, pass returned `plugins` to `loadRuntimeWebPlugins`, and let registry listeners feed existing contribution state.
- [ ] **Step 3: Verify**
Run: `pnpm --filter @hold-rein/web exec vitest run apps/web/src/app/runtime-plugin-loader.test.tsx apps/web/src/app/app-plugin.test.tsx`
Expected: PASS.
### Task 9: Externalize Built-In Plugin Dependencies
**Files:**
- Modify: `packages/plugins/base-web/package.json`
- Modify: `packages/plugins/base-web/vite.config.ts`
- Modify: `packages/plugins/base-server/package.json`
- Modify: `packages/plugins/base-server/vite.config.ts`
- Modify: `packages/plugins/ts-standards-server/package.json`
- Modify: `packages/plugins/ts-standards-server/vite.config.ts`
- [ ] **Step 1: Update package metadata**
Move host-shared packages to `peerDependencies`, keep exact build versions in `devDependencies`, and leave plugin-private dependencies in `dependencies`.
Web peer dependencies:
```json
{
  "@hold-rein/plugin-web": "workspace:^",
  "react": "19.2.6",
  "react-dom": "19.2.6",
  "antd": "6.4.3",
  "@ant-design/icons": "6.2.5",
  "@monaco-editor/react": "4.7.0",
  "monaco-editor": "0.55.1"
}
```
Server peer dependencies:
```json
{
  "@hold-rein/plugin-server": "workspace:^",
  "@earendil-works/pi-agent-core": "0.75.4",
  "@earendil-works/pi-ai": "0.76.0",
  "express": "5.2.1"
}
```
- [ ] **Step 2: Update Vite externals**
Set web plugin externals to the full web shared package list and server plugin externals to the full server shared package list.
- [ ] **Step 3: Verify builds**
Run: `pnpm --filter @hold-rein/plugins-base-web build && pnpm --filter @hold-rein/plugins-base-server build && pnpm --filter @hold-rein/plugins-ts-standards-server build`
Expected: PASS.
### Task 10: Final Verification
**Files:**
- Verify all changed files.
- [ ] **Step 1: Run typecheck**
Run: `pnpm typecheck`
Expected: PASS.
- [ ] **Step 2: Run tests**
Run: `pnpm test`
Expected: PASS.
- [ ] **Step 3: Run build**
Run: `pnpm build`
Expected: PASS.
- [ ] **Step 4: Commit implementation**
```bash
git add apps packages docs
git commit -m "feat(plugin): support runtime npm plugins"
```
