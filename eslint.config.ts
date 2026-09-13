import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslint from "@eslint/js";
import json from "@eslint/json";
import prettier from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import pkgJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import unicorn from "eslint-plugin-unicorn";
import workspaces from "eslint-plugin-workspaces";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import Path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = Path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig([
    includeIgnoreFile(gitignorePath),
    { ignores: ["**/.claude"] },
    workspaces.configs.recommended,
    {
        // Fixtures import the package by name; a relative path from the
        // copied fixture directory would not point at the source.
        files: ["packages/astro-image-svg/tests/integration/fixtures/**"],
        rules: { "workspaces/no-absolute-imports": "off" }
    },
    {
        extends: [comments.recommended],
        rules: {
            "@eslint-community/eslint-comments/require-description": "error"
        }
    },
    {
        extends: [json.configs.recommended],
        files: ["**/*.json"],
        ignores: [
            "**/package.json",
            "**/package-lock.json",
            "**/tsconfig.json",
            "**/tsconfig.*.json"
        ],
        language: "json/json",
        rules: { "json/sort-keys": "error" }
    },
    {
        extends: [json.configs.recommended],
        files: ["**/*.jsonc", ".vscode/*.json"],
        language: "json/jsonc",
        rules: { "json/sort-keys": "error" }
    },
    {
        extends: [pkgJson.configs.recommended, pkgJson.configs.stylistic],
        files: ["package.json"],
        rules: { "package-json/require-description": "off" }
    },
    {
        extends: [
            eslint.configs.recommended,
            tseslint.configs.strict,
            tseslint.configs.stylistic,
            unicorn.configs.recommended,
            perfectionist.configs["recommended-natural"]
        ],
        files: ["**/*.{ts,astro}"],
        rules: {
            "block-scoped-var": ["error"],
            "unicorn/name-replacements": ["off"],
            "unicorn/no-keyword-prefix": ["off"],
            "unicorn/prevent-abbreviations": ["off"],
            "unicorn/text-encoding-identifier-case": [
                "error",
                { withDash: true }
            ]
        }
    },
    {
        extends: [
            tseslint.configs.strictTypeChecked,
            tseslint.configs.stylisticTypeChecked
        ],
        files: ["**/*.ts"],
        languageOptions: { parserOptions: { projectService: true } },
        rules: {
            "@typescript-eslint/restrict-template-expressions": [
                "error",
                { allowBoolean: true }
            ]
        }
    },
    {
        extends: [astro.configs.recommended],
        files: ["**/*.astro"],
        rules: {
            "unicorn/filename-case": ["off"],
            "unicorn/prefer-module": ["off"]
        }
    },
    {
        extends: [
            pkgJson.configs["recommended-publishable"],
            pkgJson.configs.stylistic
        ],
        files: ["packages/**/package.json"]
    },
    {
        extends: [jsdoc.configs["flat/recommended-typescript-error"]],
        files: ["packages/**/*.ts"],
        rules: {
            "jsdoc/require-description": "error",
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param-description": "error",
            "jsdoc/require-returns-description": "error"
        }
    },
    prettier
]);
