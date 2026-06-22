import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = builtinModules.flatMap((name) => [
  name,
  `node:${name}`
]);

export default defineConfig({
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
      ]
    },
    sourcemap: true
  }
});
