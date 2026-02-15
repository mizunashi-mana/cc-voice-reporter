import { execFile } from "node:child_process";
import * as readline from "node:readline";

interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  message?: string;
  stop_hook_active?: boolean;
}

export function generateMessage(input: HookInput): string | null {
  switch (input.hook_event_name) {
    case "PreToolUse":
      return `ツール ${input.tool_name ?? "不明"} を実行します`;
    case "PostToolUse":
      return `ツール ${input.tool_name ?? "不明"} が完了しました`;
    case "Notification":
      return `通知: ${input.message ?? ""}`;
    case "Stop":
      return "処理が完了しました";
    default:
      return null;
  }
}

export function say(message: string): void {
  execFile("say", [message], (error) => {
    if (error) {
      process.stderr.write(`say command failed: ${error.message}\n`);
    }
  });
}

async function readStdin(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin });
  let data = "";
  for await (const line of rl) {
    data += line;
  }
  return data;
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const input: HookInput = JSON.parse(raw);
  const message = generateMessage(input);
  if (message) {
    say(message);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `cc-voice-reporter error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
