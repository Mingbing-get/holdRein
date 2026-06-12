import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: (format) => `index.${format === "cjs" ? "cjs" : "js"}`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: ["@hold-rein/plugin-server", "express"]
    },
    sourcemap: true
  }
});
