import { cp, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

const nodeBuiltins = builtinModules.flatMap((name) => [
  name,
  `node:${name}`
]);
const packageRoot = dirname(fileURLToPath(import.meta.url));

export interface CopyServerSkillsPluginOptions {
  outDir?: string;
  sourceDir?: string;
}

export function createCopyServerSkillsPlugin(
  options: CopyServerSkillsPluginOptions = {}
): Plugin {
  const sourceDir = options.sourceDir ?? join(packageRoot, "src/server/skills");
  const outDir = options.outDir ?? join(packageRoot, "dist");
  const targetDir = join(outDir, "skills");

  return {
    name: "copy-server-skills",
    apply: "build",
    async closeBundle() {
      await rm(targetDir, { force: true, recursive: true });
      await cp(sourceDir, targetDir, { force: true, recursive: true });
    }
  };
}

export default defineConfig({
  plugins: [createCopyServerSkillsPlugin()],
  build: {
    lib: {
      entry: "src/server.ts",
      fileName: (format) => `server.${format === "cjs" ? "cjs" : "js"}`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: [
        ...nodeBuiltins,
        "@hold-rein/plugin-server",
        "@earendil-works/pi-agent-core",
        "@earendil-works/pi-ai",
        "express",
      ]
    },
    sourcemap: true,
  }
});
