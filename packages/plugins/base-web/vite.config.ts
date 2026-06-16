import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: (format) => `index.${format === "cjs" ? "cjs" : "js"}`,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: ["@ant-design/icons", "antd", "react", "react-dom", "react/jsx-runtime"]
    },
    sourcemap: true
  }
});
