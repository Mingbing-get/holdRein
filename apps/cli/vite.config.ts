import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = builtinModules.flatMap((name) => [
  name,
  `node:${name}`
]);

export default defineConfig({
  build: {
    rollupOptions: {
      external: nodeBuiltins,
      input: {
        cli: "src/cli.ts",
        index: "src/index.ts"
      },
      output: {
        banner: (chunk): string =>
          chunk.fileName === "cli.js" ? "#!/usr/bin/env node" : "",
        entryFileNames: "[name].js",
        format: "es"
      }
    },
    sourcemap: true
  }
});
