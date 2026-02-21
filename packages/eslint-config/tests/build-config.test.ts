import { describe, expect, it } from 'vitest';
import { buildConfig } from '@cc-voice-reporter/eslint-config';

type ConfigItem = {
  name?: string;
  files?: string[];
  ignores?: string[];
  plugins?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  languageOptions?: Record<string, unknown>;
};

/**
 * Extract serializable snapshot data from ESLint config.
 * Focuses on rules, files, ignores, and settings - the parts we want to track for changes.
 */
function extractSnapshotData(config: ReturnType<typeof buildConfig>) {
  return (config as ConfigItem[]).map((item) => {
    const result: Record<string, unknown> = {};

    if (item.name !== undefined && item.name !== '') result.name = item.name;
    if (item.files !== undefined) result.files = item.files;
    if (item.ignores !== undefined) result.ignores = item.ignores;
    if (item.rules !== undefined) result.rules = item.rules;
    if (item.settings !== undefined) result.settings = item.settings;

    // Extract plugin names without the actual plugin objects (which have circular refs)
    if (item.plugins !== undefined) {
      result.plugins = Object.keys(item.plugins);
    }

    // Extract language options without parser objects
    if (item.languageOptions !== undefined) {
      const langOpts: Record<string, unknown> = {};
      const lo = item.languageOptions;

      if (lo.ecmaVersion !== undefined) langOpts.ecmaVersion = lo.ecmaVersion;
      if (lo.sourceType !== undefined) langOpts.sourceType = lo.sourceType;
      if (lo.globals !== undefined) langOpts.globals = lo.globals;
      if (lo.parser !== undefined) langOpts.parser = '[Parser]';
      if (lo.parserOptions !== undefined) {
        langOpts.parserOptions = lo.parserOptions;
      }

      if (Object.keys(langOpts).length > 0) {
        result.languageOptions = langOpts;
      }
    }

    return result;
  });
}

describe('buildConfig', () => {
  it('should generate correct config for common ruleSet only', () => {
    const config = buildConfig({
      ruleSets: ['common'],
      disableFixedRules: false,
      entrypointFiles: ['src/index.ts'],
    });

    const snapshotData = extractSnapshotData(config);
    expect(snapshotData).toMatchSnapshot();
  });

  it('should generate correct config for node ruleSet only', () => {
    const config = buildConfig({
      ruleSets: ['node'],
      disableFixedRules: false,
      entrypointFiles: ['src/index.ts'],
    });

    const snapshotData = extractSnapshotData(config);
    expect(snapshotData).toMatchSnapshot();
  });

  it('should generate correct config for common + node ruleSets', () => {
    const config = buildConfig({
      ruleSets: ['common', 'node'],
      disableFixedRules: false,
      entrypointFiles: ['src/index.ts'],
    });

    const snapshotData = extractSnapshotData(config);
    expect(snapshotData).toMatchSnapshot();
  });
});
