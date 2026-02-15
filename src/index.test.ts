import { describe, expect, it } from "vitest";
import { generateMessage } from "./index.js";

const baseInput = {
  session_id: "test",
  transcript_path: "/tmp/test",
  cwd: "/tmp",
};

describe("generateMessage", () => {
  describe("PreToolUse", () => {
    it("Bash でdescriptionがあれば概要を含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test", description: "テストを実行" },
      });
      expect(result).toBe("コマンドを実行します。テストを実行");
    });

    it("Bash でdescriptionがなければ汎用メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      });
      expect(result).toBe("コマンドを実行します");
    });

    it("Read でファイル名を含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: { file_path: "/home/user/src/index.ts" },
      });
      expect(result).toBe("index.ts を読み取ります");
    });

    it("Read でfile_pathがなければ汎用メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: {},
      });
      expect(result).toBe("ファイルを読み取ります");
    });

    it("Write でファイル名を含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: "/home/user/src/app.ts", content: "" },
      });
      expect(result).toBe("app.ts を作成します");
    });

    it("Edit でファイル名を含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/home/user/src/config.json",
          old_string: "a",
          new_string: "b",
        },
      });
      expect(result).toBe("config.json を編集します");
    });

    it("Grep で検索パターンを含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Grep",
        tool_input: { pattern: "TODO" },
      });
      expect(result).toBe("TODO を検索します");
    });

    it("Glob でパターンを含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Glob",
        tool_input: { pattern: "**/*.ts" },
      });
      expect(result).toBe("**/*.ts でファイルを検索します");
    });

    it("Task でdescriptionを含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "Task",
        tool_input: {
          description: "コード調査",
          prompt: "...",
          subagent_type: "Explore",
        },
      });
      expect(result).toBe("サブエージェントを起動します。コード調査");
    });

    it("WebFetch で汎用メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "WebFetch",
        tool_input: { url: "https://example.com", prompt: "summarize" },
      });
      expect(result).toBe("Webページを取得します");
    });

    it("WebSearch でクエリを含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "WebSearch",
        tool_input: { query: "TypeScript tutorial" },
      });
      expect(result).toBe("TypeScript tutorial をWeb検索します");
    });

    it("未知のツールは汎用メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
        tool_name: "CustomTool",
        tool_input: {},
      });
      expect(result).toBe("CustomTool を実行します");
    });

    it("tool_name が未指定なら「不明」", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PreToolUse",
      });
      expect(result).toBe("不明 を実行します");
    });
  });

  describe("PostToolUse", () => {
    it("Bash の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      });
      expect(result).toBe("コマンドが完了しました");
    });

    it("Read でファイル名を含む完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        tool_input: { file_path: "/home/user/src/index.ts" },
      });
      expect(result).toBe("index.ts の読み取りが完了しました");
    });

    it("Write でファイル名を含む完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: { file_path: "/home/user/src/app.ts" },
      });
      expect(result).toBe("app.ts を作成しました");
    });

    it("Edit でファイル名を含む完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "/home/user/src/config.json" },
      });
      expect(result).toBe("config.json の編集が完了しました");
    });

    it("Grep の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Grep",
        tool_input: { pattern: "TODO" },
      });
      expect(result).toBe("コード検索が完了しました");
    });

    it("Glob の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Glob",
        tool_input: { pattern: "**/*.ts" },
      });
      expect(result).toBe("ファイル検索が完了しました");
    });

    it("Task の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "Task",
        tool_input: {},
      });
      expect(result).toBe("サブエージェントが完了しました");
    });

    it("WebFetch の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "WebFetch",
        tool_input: {},
      });
      expect(result).toBe("Webページの取得が完了しました");
    });

    it("WebSearch の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "WebSearch",
        tool_input: {},
      });
      expect(result).toBe("Web検索が完了しました");
    });

    it("未知のツールは汎用メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUse",
        tool_name: "CustomTool",
        tool_input: {},
      });
      expect(result).toBe("CustomTool が完了しました");
    });
  });

  describe("PostToolUseFailure", () => {
    it("ツール名を含む失敗メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        error: "command not found",
      });
      expect(result).toBe("Bash が失敗しました");
    });

    it("ツール名が未指定なら「ツール」", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "PostToolUseFailure",
      });
      expect(result).toBe("ツール が失敗しました");
    });
  });

  describe("Notification", () => {
    it("permission_prompt で許可メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "Notification",
        notification_type: "permission_prompt",
        message: "Allow Bash?",
      });
      expect(result).toBe("許可が必要です");
    });

    it("idle_prompt で入力待ちメッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "Notification",
        notification_type: "idle_prompt",
        message: "Waiting for input",
      });
      expect(result).toBe("入力を待っています");
    });

    it("その他のタイプはメッセージを含む", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "Notification",
        notification_type: "auth_success",
        message: "認証が完了しました",
      });
      expect(result).toBe("通知: 認証が完了しました");
    });

    it("メッセージが空なら汎用通知", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "Notification",
      });
      expect(result).toBe("通知があります");
    });
  });

  describe("Stop", () => {
    it("通常の完了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "Stop",
      });
      expect(result).toBe("処理が完了しました");
    });

    it("stop_hook_active が true なら null を返す", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "Stop",
        stop_hook_active: true,
      });
      expect(result).toBeNull();
    });
  });

  describe("SessionStart", () => {
    it("通常の開始メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SessionStart",
        source: "startup",
      });
      expect(result).toBe("セッションを開始しました");
    });

    it("resume で再開メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SessionStart",
        source: "resume",
      });
      expect(result).toBe("セッションを再開しました");
    });

    it("clear でクリアメッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SessionStart",
        source: "clear",
      });
      expect(result).toBe("セッションをクリアしました");
    });

    it("compact で圧縮メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SessionStart",
        source: "compact",
      });
      expect(result).toBe("コンテキストを圧縮しました");
    });

    it("source が未指定なら開始メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SessionStart",
      });
      expect(result).toBe("セッションを開始しました");
    });
  });

  describe("SessionEnd", () => {
    it("終了メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SessionEnd",
        reason: "prompt_input_exit",
      });
      expect(result).toBe("セッションを終了します");
    });
  });

  describe("UserPromptSubmit", () => {
    it("プロンプト受付メッセージ", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "UserPromptSubmit",
        prompt: "Hello",
      });
      expect(result).toBe("プロンプトを受け付けました");
    });
  });

  describe("未対応イベント", () => {
    it("未対応のイベントでは null を返す", () => {
      const result = generateMessage({
        ...baseInput,
        hook_event_name: "SubagentStart",
      });
      expect(result).toBeNull();
    });
  });
});
