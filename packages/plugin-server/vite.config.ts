import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: (format) => `index.${format === "cjs" ? "cjs" : "js"}`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: ["@earendil-works/pi-agent-core", "@earendil-works/pi-ai"]
    },
    sourcemap: true
  }
});
