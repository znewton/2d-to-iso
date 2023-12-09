import jsdoc from "eslint-plugin-jsdoc";
import prettier from "eslint-config-prettier";
import globals from "globals";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        plugins: {
            jsdoc,
        },
        linterOptions: {
            noInlineConfig: true,
        },
        files: ["**/*.js"],
        ignores: ["node_modules/*"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            ...prettier.rules,
        },
    },
];
