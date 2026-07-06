import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = builtinModules.flatMap((name) => [
  name,
  `node:${name}`
]);

export default defineConfig({
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
        "express"
      ]
    },
    sourcemap: true
  }
});
