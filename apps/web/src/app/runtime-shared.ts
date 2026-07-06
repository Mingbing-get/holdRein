import * as AntDesignIcons from "@ant-design/icons";
import * as HoldReinPluginWeb from "@hold-rein/plugin-web";
import * as MonacoEditorReact from "@monaco-editor/react";
import * as Antd from "antd";
import * as MonacoEditor from "monaco-editor";
import * as React from "react";
import * as ReactDom from "react-dom";
import * as ReactJsxDevRuntime from "react/jsx-dev-runtime";
import * as ReactJsxRuntime from "react/jsx-runtime";

export interface RuntimeSharedPackages {
  readonly antd: typeof Antd;
  readonly icons: unknown;
  readonly monaco: typeof MonacoEditor;
  readonly monacoReact: unknown;
  readonly pluginWeb: typeof HoldReinPluginWeb;
  readonly react: typeof React;
  readonly reactDom: typeof ReactDom;
  readonly reactJsxDevRuntime: typeof ReactJsxDevRuntime;
  readonly reactJsxRuntime: typeof ReactJsxRuntime;
}

declare global {
  var __HOLD_REIN_SHARED__: RuntimeSharedPackages | undefined;
}

export function registerRuntimeSharedPackages(): RuntimeSharedPackages {
  const sharedPackages: RuntimeSharedPackages = {
    antd: Antd,
    icons: toSharedModuleValue(AntDesignIcons),
    monaco: MonacoEditor,
    monacoReact: toSharedModuleValue(MonacoEditorReact),
    pluginWeb: HoldReinPluginWeb,
    react: React,
    reactDom: ReactDom,
    reactJsxDevRuntime: ReactJsxDevRuntime,
    reactJsxRuntime: ReactJsxRuntime
  };

  globalThis.__HOLD_REIN_SHARED__ = sharedPackages;

  return sharedPackages;
}

function toSharedModuleValue(
  module: Record<string, unknown> & { readonly default?: unknown }
): unknown {
  const defaultExport = module.default;

  if (
    defaultExport === null ||
    (typeof defaultExport !== "function" && typeof defaultExport !== "object")
  ) {
    return module;
  }

  return Object.assign(defaultExport, module);
}
