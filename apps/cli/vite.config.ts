import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
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
