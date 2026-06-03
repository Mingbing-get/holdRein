import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs.strict.rules,
      ...tsPlugin.configs.stylistic.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-redeclare": "off",
      "max-lines": ["error", { "max": 200, "skipBlankLines": true, "skipComments": true }]
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "max-lines": "off"
    }
  }
];
