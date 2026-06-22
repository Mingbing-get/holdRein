import { builtinModules } from "node:module";
import { cp } from "node:fs/promises";
import { defineConfig } from "vite";

const nodeBuiltins = builtinModules.flatMap((name) => [
  name,
  `node:${name}`
]);

export default defineConfig({
  plugins: [
    {
      name: "copy-ts-standards-skills",
      async closeBundle() {
        await cp("src/skills", "dist/skills", { recursive: true });
      }
    }
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: (format) => `index.${format === "cjs" ? "cjs" : "js"}`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: [
        ...nodeBuiltins,
        "@earendil-works/pi-agent-core",
        "@earendil-works/pi-ai",
        "@hold-rein/plugin-server",
        "express"
      ],
      output: {
        exports: "named"
      }
    },
    sourcemap: true
  }
});
