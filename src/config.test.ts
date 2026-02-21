import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  getDefaultConfigPath,
  loadConfig,
  resolveOptions,
} from "./config.js";

describe("ConfigSchema", () => {
  it("accepts an empty object", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a full config", () => {
    const result = ConfigSchema.safeParse({
      filter: {
        include: ["project-a"],
        exclude: ["/absolute/path"],
      },
      projectsDir: "/custom/projects",
      debounceMs: 300,
      speaker: {
        maxLength: 150,
        truncationSeparator: "...",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a partial config", () => {
    const result = ConfigSchema.safeParse({
      debounceMs: 1000,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ debounceMs: 1000 });
  });

  it("rejects unknown keys", () => {
    const result = ConfigSchema.safeParse({
      unknownKey: "value",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid debounceMs (non-positive)", () => {
    const result = ConfigSchema.safeParse({
      debounceMs: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid debounceMs (non-integer)", () => {
    const result = ConfigSchema.safeParse({
      debounceMs: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid speaker.maxLength (non-positive)", () => {
    const result = ConfigSchema.safeParse({
      speaker: { maxLength: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts ollama config", () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: "gemma3" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts ollama config with baseUrl", () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: "gemma3", baseUrl: "http://localhost:9999" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects ollama config without model", () => {
    const result = ConfigSchema.safeParse({
      ollama: { baseUrl: "http://localhost:11434" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects ollama config with invalid baseUrl", () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: "gemma3", baseUrl: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts translation config", () => {
    const result = ConfigSchema.safeParse({
      translation: { use: "ollama", outputLanguage: "ja" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects translation with unsupported backend", () => {
    const result = ConfigSchema.safeParse({
      translation: { use: "unsupported", outputLanguage: "ja" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects translation without outputLanguage", () => {
    const result = ConfigSchema.safeParse({
      translation: { use: "ollama" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts full config with ollama and translation", () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: "translategemma", baseUrl: "http://localhost:11434" },
      translation: { use: "ollama", outputLanguage: "ja" },
      debounceMs: 300,
    });
    expect(result.success).toBe(true);
  });

  it("accepts summary config", () => {
    const result = ConfigSchema.safeParse({
      summary: { enabled: true, intervalMs: 30000 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts summary config with only enabled", () => {
    const result = ConfigSchema.safeParse({
      summary: { enabled: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects summary without enabled field", () => {
    const result = ConfigSchema.safeParse({
      summary: { intervalMs: 30000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects summary with invalid intervalMs", () => {
    const result = ConfigSchema.safeParse({
      summary: { enabled: true, intervalMs: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts narration boolean", () => {
    const result = ConfigSchema.safeParse({ narration: true });
    expect(result.success).toBe(true);
  });

  it("accepts narration false", () => {
    const result = ConfigSchema.safeParse({ narration: false });
    expect(result.success).toBe(true);
  });

  it("rejects narration non-boolean", () => {
    const result = ConfigSchema.safeParse({ narration: "yes" });
    expect(result.success).toBe(false);
  });
});

describe("getDefaultConfigPath", () => {
  const originalEnv = process.env["XDG_CONFIG_HOME"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["XDG_CONFIG_HOME"];
    } else {
      process.env["XDG_CONFIG_HOME"] = originalEnv;
    }
  });

  it("uses XDG_CONFIG_HOME when set", () => {
    process.env["XDG_CONFIG_HOME"] = "/custom/config";
    expect(getDefaultConfigPath()).toBe(
      "/custom/config/cc-voice-reporter/config.json",
    );
  });

  it("falls back to ~/.config when XDG_CONFIG_HOME is not set", () => {
    delete process.env["XDG_CONFIG_HOME"];
    const expected = path.join(
      os.homedir(),
      ".config",
      "cc-voice-reporter",
      "config.json",
    );
    expect(getDefaultConfigPath()).toBe(expected);
  });
});

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cc-voice-reporter-config-test-"),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty config when default path does not exist", async () => {
    // loadConfig with no arg uses getDefaultConfigPath().
    // Override XDG to point to a non-existent dir.
    const originalEnv = process.env["XDG_CONFIG_HOME"];
    process.env["XDG_CONFIG_HOME"] = path.join(tmpDir, "nonexistent");
    try {
      const config = await loadConfig();
      expect(config).toEqual({});
    } finally {
      if (originalEnv === undefined) {
        delete process.env["XDG_CONFIG_HOME"];
      } else {
        process.env["XDG_CONFIG_HOME"] = originalEnv;
      }
    }
  });

  it("throws when --config path does not exist", async () => {
    const missingPath = path.join(tmpDir, "missing.json");
    await expect(loadConfig(missingPath)).rejects.toThrow(
      "Config file not found",
    );
  });

  it("loads a valid config file", async () => {
    const configPath = path.join(tmpDir, "config.json");
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ debounceMs: 300 }),
    );
    const config = await loadConfig(configPath);
    expect(config).toEqual({ debounceMs: 300 });
  });

  it("loads a full config file", async () => {
    const configPath = path.join(tmpDir, "config.json");
    const fullConfig = {
      filter: { include: ["a"], exclude: ["b"] },
      projectsDir: "/custom",
      debounceMs: 200,
      speaker: { maxLength: 50, truncationSeparator: "..." },
    };
    await fs.promises.writeFile(configPath, JSON.stringify(fullConfig));
    const config = await loadConfig(configPath);
    expect(config).toEqual(fullConfig);
  });

  it("throws on invalid JSON", async () => {
    const configPath = path.join(tmpDir, "config.json");
    await fs.promises.writeFile(configPath, "not json {{{");
    await expect(loadConfig(configPath)).rejects.toThrow("Invalid JSON");
  });

  it("throws on schema validation error", async () => {
    const configPath = path.join(tmpDir, "config.json");
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ unknownKey: true }),
    );
    await expect(loadConfig(configPath)).rejects.toThrow("Invalid config file");
  });

  it("throws on invalid field type", async () => {
    const configPath = path.join(tmpDir, "config.json");
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ debounceMs: "not a number" }),
    );
    await expect(loadConfig(configPath)).rejects.toThrow("Invalid config file");
  });
});

describe("resolveOptions", () => {
  it("returns config values when no CLI args", () => {
    const options = resolveOptions(
      {
        filter: { include: ["a"], exclude: ["b"] },
        projectsDir: "/custom",
        debounceMs: 300,
        speaker: { maxLength: 50 },
      },
      {},
    );
    expect(options).toMatchObject({
      watcher: {
        projectsDir: "/custom",
        filter: { include: ["a"], exclude: ["b"] },
      },
      speaker: { maxLength: 50 },
      debounceMs: 300,
      narration: true,
    });
  });

  it("returns CLI args when no config", () => {
    const options = resolveOptions({}, { include: ["x"], exclude: ["y"] });
    expect(options).toMatchObject({
      watcher: {
        projectsDir: undefined,
        filter: { include: ["x"], exclude: ["y"] },
      },
      speaker: undefined,
      debounceMs: undefined,
      narration: true,
    });
  });

  it("CLI args override config filter", () => {
    const options = resolveOptions(
      { filter: { include: ["config-a"], exclude: ["config-b"] } },
      { include: ["cli-a"] },
    );
    // include from CLI overrides config, but exclude from config is preserved
    expect(options.watcher?.filter?.include).toEqual(["cli-a"]);
    expect(options.watcher?.filter?.exclude).toEqual(["config-b"]);
  });

  it("CLI exclude overrides config exclude", () => {
    const options = resolveOptions(
      { filter: { exclude: ["config-b"] } },
      { exclude: ["cli-b"] },
    );
    expect(options.watcher?.filter?.exclude).toEqual(["cli-b"]);
  });

  it("returns defaults when both config and CLI are empty", () => {
    const options = resolveOptions({}, {});
    expect(options).toMatchObject({
      watcher: {
        projectsDir: undefined,
        filter: {},
      },
      speaker: undefined,
      debounceMs: undefined,
      narration: true,
    });
  });

  it("preserves speaker and debounceMs from config", () => {
    const options = resolveOptions(
      {
        debounceMs: 1000,
        speaker: { maxLength: 200, truncationSeparator: "..." },
      },
      {},
    );
    expect(options.debounceMs).toBe(1000);
    expect(options.speaker).toEqual({
      maxLength: 200,
      truncationSeparator: "...",
    });
  });

  it("resolves translation when ollama and translation are configured", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3", baseUrl: "http://localhost:9999" },
        translation: { use: "ollama", outputLanguage: "ja" },
      },
      {},
    );
    expect(options.translation).toEqual({
      outputLanguage: "ja",
      ollama: { model: "gemma3", baseUrl: "http://localhost:9999" },
    });
  });

  it("resolves translation with default baseUrl when not specified", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3" },
        translation: { use: "ollama", outputLanguage: "en" },
      },
      {},
    );
    expect(options.translation).toEqual({
      outputLanguage: "en",
      ollama: { model: "gemma3", baseUrl: undefined },
    });
  });

  it("does not resolve translation when ollama config is missing", () => {
    const options = resolveOptions(
      {
        translation: { use: "ollama", outputLanguage: "ja" },
      },
      {},
    );
    expect(options.translation).toBeUndefined();
  });

  it("does not resolve translation when translation config is missing", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3" },
      },
      {},
    );
    expect(options.translation).toBeUndefined();
  });

  it("resolves summary when ollama and summary are configured", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3", baseUrl: "http://localhost:9999" },
        summary: { enabled: true, intervalMs: 30000 },
      },
      {},
    );
    expect(options.summary).toEqual({
      ollama: { model: "gemma3", baseUrl: "http://localhost:9999" },
      intervalMs: 30000,
    });
  });

  it("throws when summary is enabled but ollama is missing", () => {
    expect(() =>
      resolveOptions(
        { summary: { enabled: true } },
        {},
      ),
    ).toThrow("summary feature requires ollama configuration");
  });

  it("does not resolve summary when summary is disabled", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3" },
        summary: { enabled: false },
      },
      {},
    );
    expect(options.summary).toBeUndefined();
  });

  it("does not resolve summary when summary config is missing", () => {
    const options = resolveOptions(
      { ollama: { model: "gemma3" } },
      {},
    );
    expect(options.summary).toBeUndefined();
  });

  it("narration defaults to true when summary is not enabled", () => {
    const options = resolveOptions({}, {});
    expect(options.narration).toBe(true);
  });

  it("narration defaults to false when summary is enabled", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3" },
        summary: { enabled: true },
      },
      {},
    );
    expect(options.narration).toBe(false);
  });

  it("explicit narration true overrides summary default", () => {
    const options = resolveOptions(
      {
        ollama: { model: "gemma3" },
        summary: { enabled: true },
        narration: true,
      },
      {},
    );
    expect(options.narration).toBe(true);
  });

  it("explicit narration false disables narration without summary", () => {
    const options = resolveOptions(
      { narration: false },
      {},
    );
    expect(options.narration).toBe(false);
  });
});
