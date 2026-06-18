import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "docs/**", "**/*.zip"],
  },
  js.configs.recommended,
  {
    files: ["content.js", "popup.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
