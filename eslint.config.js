import jsdoc from "eslint-plugin-jsdoc";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        plugins: {
            jsdoc
        },
        linterOptions: {
            noInlineConfig: true
        },
        files: ["**/*.js"],
        ignores: ["node_modules"],
        env: {
            "node": true,
            "es6": true,
        },
        languageOptions: {
            ecmaVersion: "6",
            sourceType: "module",
        },
    },
];
