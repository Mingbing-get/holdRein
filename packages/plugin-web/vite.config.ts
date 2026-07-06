import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        "runtime/vite-shared-plugin": "src/runtime/vite-shared-plugin.ts"
      },
      fileName: (format, entryName) =>
        `${entryName}.${format === "cjs" ? "cjs" : "js"}`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: [
        "@ant-design/icons",
        "antd",
        "node:module",
        "node:url",
        "react",
        "react/jsx-runtime"
      ]
    },
    sourcemap: true
  }
});
