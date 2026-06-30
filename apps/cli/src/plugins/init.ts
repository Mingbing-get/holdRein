import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface InitPluginPackageResult {
  readonly packageName: string;
}

export interface InitPluginPackageOptions {
  readonly name?: string;
  readonly path?: string;
}

const basePackageJson = {
  name: "@hold-rein/plugins-base",
  version: "0.0.0",
  private: true,
  type: "module",
  main: "./src/server.ts",
  module: "./src/server.ts",
  types: "./src/server.ts",
  exports: {
    "./server": {
      types: "./src/server.ts",
      import: "./src/server.ts",
      require: "./src/server.ts"
    },
    "./web": {
      types: "./src/web.ts",
      style: "./dist/style.css",
      import: "./src/web.ts",
      require: "./src/web.ts"
    }
  },
  files: ["dist"],
  publishConfig: {
    access: "restricted",
    main: "./dist/server.cjs",
    module: "./dist/server.js",
    types: "./dist/server.d.ts",
    exports: {
      "./server": {
        types: "./dist/server.d.ts",
        import: "./dist/server.js",
        require: "./dist/server.cjs"
      },
      "./web": {
        types: "./dist/web.d.ts",
        style: "./dist/style.css",
        default: "./dist/web.umd.cjs",
        require: "./dist/web.umd.cjs"
      }
    }
  },
  scripts: {
    build:
      "vite build --config vite.config.ts && vite build --config vite.web.config.ts && tsc -p tsconfig.json --emitDeclarationOnly",
    typecheck: "tsc -p tsconfig.json --noEmit"
  },
  peerDependencies: {
    "@earendil-works/pi-agent-core": "0.75.4",
    "@earendil-works/pi-ai": "0.76.0",
    "@hold-rein/plugin-server": "workspace:^",
    express: "5.2.1",
    "@ant-design/icons": "6.2.5",
    "@hold-rein/plugin-web": "workspace:^",
    "@monaco-editor/react": "4.7.0",
    antd: "6.4.3",
    "monaco-editor": "0.55.1",
    react: "19.2.6",
    "react-dom": "19.2.6"
  },
  devDependencies: {
    "@earendil-works/pi-agent-core": "0.75.4",
    "@earendil-works/pi-ai": "0.76.0",
    "@hold-rein/plugin-server": "workspace:^",
    express: "5.2.1",
    vite: "6.3.5",
    "@ant-design/icons": "6.2.5",
    "@hold-rein/plugin-web": "workspace:^",
    "@monaco-editor/react": "4.7.0",
    "@types/react": "19.2.15",
    antd: "6.4.3",
    "monaco-editor": "0.55.1",
    react: "19.2.6",
    "react-dom": "19.2.6"
  }
} as const;

const tsconfigJson = `{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022",
    "useDefineForClassFields": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
}
`;

const viteConfigTs = `import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = builtinModules.flatMap((name) => [
  name,
  \`node:\${name}\`
]);

export default defineConfig({
  build: {
    lib: {
      entry: "src/server.ts",
      fileName: (format) => \`server.\${format === "cjs" ? "cjs" : "js"}\`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: [
        ...nodeBuiltins,
        "@hold-rein/plugin-server",
        "@earendil-works/pi-agent-core",
        "@earendil-works/pi-ai",
        "express"
      ]
    },
    sourcemap: true
  }
});
`;

const viteWebConfigTs = `import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      cssFileName: "style",
      entry: "src/web.ts",
      fileName: () => "web.umd.cjs",
      formats: ["umd"],
      name: "HoldReinPlugin"
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        "@ant-design/icons",
        "@hold-rein/plugin-web",
        "@monaco-editor/react",
        "antd",
        "monaco-editor",
        "react",
        "react-dom",
        "react/jsx-runtime"
      ]
    }
  }
});
`;

export const initPluginPackage = (
  currentWorkingDirectory: string,
  options: InitPluginPackageOptions = {}
): InitPluginPackageResult => {
  const targetRootDirectory = options.path ?? currentWorkingDirectory;
  const targetDirectory =
    options.name === undefined
      ? targetRootDirectory
      : join(targetRootDirectory, options.name);
  const folderName = basename(targetDirectory);
  const packageName = `hold-rein-plugin-${folderName}`;
  const packageJson = {
    ...basePackageJson,
    name: packageName
  };

  writeFiles(targetDirectory, {
    "package.json": `${JSON.stringify(packageJson, null, 2)}\n`,
    "tsconfig.json": tsconfigJson,
    "vite.config.ts": viteConfigTs,
    "vite.web.config.ts": viteWebConfigTs,
    "src/plugin-id.ts": `export const PLUGIN_ID = "__${folderName}__plugin";\n`,
    "src/server.ts": createServerPluginSource(),
    "src/web.ts": createWebPluginSource()
  });

  return { packageName };
};

function writeFiles(
  currentWorkingDirectory: string,
  files: Readonly<Record<string, string>>
): void {
  for (const relativePath of Object.keys(files)) {
    const path = join(currentWorkingDirectory, relativePath);

    if (existsSync(path)) {
      throw new Error(`Refusing to overwrite existing file: ${relativePath}`);
    }
  }

  mkdirSync(join(currentWorkingDirectory, "src"), { recursive: true });

  for (const [relativePath, contents] of Object.entries(files)) {
    writeFileSync(join(currentWorkingDirectory, relativePath), contents);
  }
}

function createServerPluginSource(): string {
  return `import type { ServerPlugin } from "@hold-rein/plugin-server";

import { PLUGIN_ID } from "./plugin-id";

const serverPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID
};

export default serverPlugin;
`;
}

function createWebPluginSource(): string {
  return `import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "./plugin-id";

const webPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID
};

export default webPlugin;
`;
}
