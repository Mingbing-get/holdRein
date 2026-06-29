import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      cssFileName: "style",
      entry: "src/web.ts",
      fileName: () => "web.umd.cjs",
      formats: ["umd"],
      name: "HoldReinBaseExamplePlugin"
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
});
