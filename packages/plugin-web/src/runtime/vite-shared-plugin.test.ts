import { describe, expect, it } from "vitest";
import * as AntDesignIcons from "@ant-design/icons";
import * as Antd from "antd";

import { createHoldReinSharedVitePlugin } from "./vite-shared-plugin";

describe("createHoldReinSharedVitePlugin", () => {
  it("resolves host shared packages to virtual modules", () => {
    const plugin = createHoldReinSharedVitePlugin();

    expect(plugin.enforce).toBe("pre");
    expect(plugin.resolveId?.("react")).toBe("\0hold-rein-shared:react");
    expect(plugin.resolveId?.("react/jsx-runtime")).toBe(
      "\0hold-rein-shared:react/jsx-runtime"
    );
    expect(plugin.resolveId?.("react/jsx-dev-runtime")).toBe(
      "\0hold-rein-shared:react/jsx-dev-runtime"
    );
    expect(plugin.resolveId?.("not-shared")).toBeNull();
  });

  it("loads virtual modules from the host shared global", async () => {
    const plugin = createHoldReinSharedVitePlugin();
    const source = await plugin.load?.("\0hold-rein-shared:react/jsx-dev-runtime");

    expect(source).toContain("__HOLD_REIN_SHARED__.reactJsxDevRuntime");
    expect(source).toContain('ReactJsxDevRuntime["jsxDEV"]');
    expect(source).toContain("as jsxDEV");
  });

  it("exports every named antd binding from the host shared global", async () => {
    const plugin = createHoldReinSharedVitePlugin();
    const source = await plugin.load?.("\0hold-rein-shared:antd");

    for (const exportName of Object.keys(Antd)) {
      if (isIgnoredExportName(exportName)) continue;

      expect(source).toContain(`as ${formatExpectedExportName(exportName)}`);
    }
  });

  it("exports every named icon binding from the host shared global", async () => {
    const plugin = createHoldReinSharedVitePlugin();
    const source = await plugin.load?.("\0hold-rein-shared:@ant-design/icons");

    for (const exportName of Object.keys(AntDesignIcons)) {
      if (isIgnoredExportName(exportName)) continue;

      expect(source).toContain(`as ${formatExpectedExportName(exportName)}`);
    }
  });

  it("exports every named Monaco React binding from the host shared global", async () => {
    const plugin = createHoldReinSharedVitePlugin();
    plugin.configResolved?.({
      root: `${process.cwd()}/packages/plugins/github`
    } as Parameters<NonNullable<typeof plugin.configResolved>>[0]);
    const source = await plugin.load?.("\0hold-rein-shared:@monaco-editor/react");

    expect(source).toContain("as DiffEditor");
    expect(source).toContain("as Editor");
    expect(source).toContain("as loader");
    expect(source).toContain("as useMonaco");
  });

  it("exports the Monaco editor namespace from the host shared global", async () => {
    const plugin = createHoldReinSharedVitePlugin();
    const source = await plugin.load?.("\0hold-rein-shared:monaco-editor");

    expect(source).toContain("__HOLD_REIN_SHARED__.monaco");
    expect(source).toContain("as editor");
  });

  it("excludes shared packages from Vite dependency pre-bundling", () => {
    const plugin = createHoldReinSharedVitePlugin();

    expect(plugin.config?.()).toMatchObject({
      optimizeDeps: {
        exclude: expect.arrayContaining([
          "@ant-design/icons",
          "@hold-rein/plugin-web",
          "antd",
          "react",
          "react-dom",
          "react/jsx-dev-runtime",
          "react/jsx-runtime"
        ])
      }
    });
  });
});

function formatExpectedExportName(exportName: string): string {
  return /^[$A-Z_a-z][$\w]*$/.test(exportName)
    ? exportName
    : JSON.stringify(exportName);
}

function isIgnoredExportName(exportName: string): boolean {
  return ["__esModule", "default", "module.exports"].includes(exportName);
}
