import { describe, expect, it } from "vitest";
import { generateMessage } from "./index.js";

describe("generateMessage", () => {
  it("PreToolUse でツール名を含むメッセージを返す", () => {
    const result = generateMessage({
      session_id: "test",
      transcript_path: "/tmp/test",
      cwd: "/tmp",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
    });
    expect(result).toBe("ツール Bash を実行します");
  });

  it("PostToolUse でツール名を含むメッセージを返す", () => {
    const result = generateMessage({
      session_id: "test",
      transcript_path: "/tmp/test",
      cwd: "/tmp",
      hook_event_name: "PostToolUse",
      tool_name: "Read",
    });
    expect(result).toBe("ツール Read が完了しました");
  });

  it("Notification で通知メッセージを返す", () => {
    const result = generateMessage({
      session_id: "test",
      transcript_path: "/tmp/test",
      cwd: "/tmp",
      hook_event_name: "Notification",
      message: "許可が必要です",
    });
    expect(result).toBe("通知: 許可が必要です");
  });

  it("Stop で完了メッセージを返す", () => {
    const result = generateMessage({
      session_id: "test",
      transcript_path: "/tmp/test",
      cwd: "/tmp",
      hook_event_name: "Stop",
    });
    expect(result).toBe("処理が完了しました");
  });

  it("未対応のイベントでは null を返す", () => {
    const result = generateMessage({
      session_id: "test",
      transcript_path: "/tmp/test",
      cwd: "/tmp",
      hook_event_name: "SessionStart",
    });
    expect(result).toBeNull();
  });
});
