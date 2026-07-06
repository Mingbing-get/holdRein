import type { Plugin } from "vite";

const VIRTUAL_MODULE_PREFIX = "\0hold-rein-shared:";

interface SharedModuleDefinition {
  readonly fallbackExportNames?: readonly string[];
  readonly globalKey: string;
  readonly localName: string;
}

const SHARED_MODULES = new Map<string, SharedModuleDefinition>([
  ["react", { globalKey: "react", localName: "React" }],
  ["react-dom", { globalKey: "reactDom", localName: "ReactDom" }],
  [
    "react/jsx-runtime",
    { globalKey: "reactJsxRuntime", localName: "ReactJsxRuntime" }
  ],
  [
    "react/jsx-dev-runtime",
    { globalKey: "reactJsxDevRuntime", localName: "ReactJsxDevRuntime" }
  ],
  ["antd", { globalKey: "antd", localName: "Antd" }],
  ["@ant-design/icons", { globalKey: "icons", localName: "Icons" }],
  [
    "@monaco-editor/react",
    { globalKey: "monacoReact", localName: "MonacoReact" }
  ],
  [
    "monaco-editor",
    {
      fallbackExportNames: ["editor"],
      globalKey: "monaco",
      localName: "MonacoEditor"
    }
  ],
  ["@hold-rein/plugin-web", { globalKey: "pluginWeb", localName: "PluginWeb" }]
]);
const SHARED_MODULE_IDS = [...SHARED_MODULES.keys()];
const EXPORT_NAME_PATTERN = /^[$A-Z_a-z][$\w]*$/;
const IGNORED_EXPORT_NAMES = new Set(["__esModule", "default", "module.exports"]);

export function createHoldReinSharedVitePlugin(): Plugin {
  let root = process.cwd();

  return {
    enforce: "pre",
    name: "hold-rein-shared-modules",
    config() {
      return {
        optimizeDeps: {
          exclude: SHARED_MODULE_IDS
        }
      };
    },
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (!SHARED_MODULES.has(id)) {
        return null;
      }

      return `${VIRTUAL_MODULE_PREFIX}${id}`;
    },
    async load(id) {
      if (!id.startsWith(VIRTUAL_MODULE_PREFIX)) {
        return null;
      }

      const moduleId = id.slice(VIRTUAL_MODULE_PREFIX.length);
      const definition = SHARED_MODULES.get(moduleId);
      if (!definition) {
        return null;
      }

      return createSharedModuleSource(
        definition,
        await resolveExportNames(moduleId, root, definition)
      );
    }
  };
}

async function resolveExportNames(
  moduleId: string,
  root: string,
  definition: SharedModuleDefinition
): Promise<string[]> {
  if (definition.fallbackExportNames) {
    return [...definition.fallbackExportNames];
  }

  const [{ createRequire }, { pathToFileURL }] = await Promise.all([
    import("node:module"),
    import("node:url")
  ]);
  const require = createRequire(`${root}/vite.web.config.ts`);
  const modulePath = require.resolve(moduleId);
  const module = await import(pathToFileURL(modulePath).href);

  return Object.keys(module);
}

function createSharedModuleSource(
  definition: SharedModuleDefinition,
  exportNames: readonly string[]
): string {
  const lines = [
    `const ${definition.localName} = globalThis.__HOLD_REIN_SHARED__.${definition.globalKey};`,
    `export default ${definition.localName};`
  ];

  exportNames
    .filter((exportName) => !IGNORED_EXPORT_NAMES.has(exportName))
    .forEach((exportName, index) => {
      const localExportName = `__holdReinSharedExport${index}`;
      lines.push(
        `const ${localExportName} = ${definition.localName}[${JSON.stringify(exportName)}];`,
        `export { ${localExportName} as ${formatExportName(exportName)} };`
      );
    });

  return lines.join("\n");
}

function formatExportName(exportName: string): string {
  return EXPORT_NAME_PATTERN.test(exportName)
    ? exportName
    : JSON.stringify(exportName);
}
