import * as AntDesignIcons from "@ant-design/icons";
import * as HoldReinPluginWeb from "@hold-rein/plugin-web";
import * as MonacoEditorReact from "@monaco-editor/react";
import * as Antd from "antd";
import * as MonacoEditor from "monaco-editor";
import * as React from "react";
import * as ReactDom from "react-dom";

import { require } from "@hold-rein/plugin-web";
import { registerRuntimeSharedPackages } from "./runtime-shared";

export function registerRuntimePluginPackages(): void {
  const sharedPackages = registerRuntimeSharedPackages();
  require.register("@ant-design/icons", toAmdModuleValue(AntDesignIcons));
  require.register("@hold-rein/plugin-web", HoldReinPluginWeb);
  require.register("@monaco-editor/react", toAmdModuleValue(MonacoEditorReact));
  require.register("antd", Antd);
  require.register("monaco-editor", MonacoEditor);
  require.register("react", React);
  require.register("react-dom", ReactDom);
  require.register("react/jsx-dev-runtime", sharedPackages.reactJsxDevRuntime);
  require.register("react/jsx-runtime", sharedPackages.reactJsxRuntime);
}

function toAmdModuleValue(
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
