import { createHoldReinSharedVitePlugin } from "@hold-rein/plugin-web/vite-shared-plugin";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? [createHoldReinSharedVitePlugin()] : [],
  build: {
    emptyOutDir: false,
    lib: {
      cssFileName: "style",
      entry: "src/web.ts",
      fileName: () => "web.umd.cjs",
      formats: ["umd"],
      name: "HoldReinTsStandardsPlugin"
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        "@ant-design/icons",
        "@hold-rein/plugin-web",
        "@monaco-editor/react",
        "antd",
        "monaco-editor",
        "react",
        "react-dom",
        "react/jsx-runtime"
      ]
    }
  }
}));
