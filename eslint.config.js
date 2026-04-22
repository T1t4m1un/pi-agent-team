import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.ts"],
    plugins: { "import-x": importPlugin },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import-x/order": ["warn", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "never",
        alphabetize: { order: "asc", caseInsensitive: true },
      }],
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["../*"],
          message: "Use @/ alias instead of relative parent imports in src/",
        }],
      }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    plugins: { "import-x": importPlugin },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import-x/order": ["warn", {
        groups: ["builtin", "external", ["internal", "parent"], "sibling", "index"],
        "newlines-between": "never",
        alphabetize: { order: "asc", caseInsensitive: true },
      }],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "*.js"],
  },
);
