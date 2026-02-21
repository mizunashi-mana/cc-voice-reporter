import { buildConfig } from "@cc-voice-reporter/eslint-config";

export default [
  ...buildConfig({
    entrypointFiles: [
      "packages/cc-voice-reporter/src/cli.ts",
      "packages/cc-voice-reporter/scripts/cc-edit-lint-hook.mjs",
    ],
  }),
  {
    files: ["packages/cc-voice-reporter/scripts/**"],
    rules: {
      "n/hashbang": "off",
    },
  },
];
