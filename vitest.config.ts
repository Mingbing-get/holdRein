import { defineConfig } from "vitest/config";
import { URL, fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@hold-rein/utils": fileURLToPath(
        new URL("./packages/utils/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    coverage: {
      provider: "v8"
    },
    globals: true,
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx"
    ]
  }
});
