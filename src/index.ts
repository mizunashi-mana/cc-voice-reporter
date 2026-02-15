import { execFile } from "node:child_process";
import * as readline from "node:readline";

interface HookInput {
  // 共通フィールド
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;

  // PreToolUse / PostToolUse / PostToolUseFailure
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;

  // PostToolUse
  tool_response?: Record<string, unknown>;

  // PostToolUseFailure
  error?: string;

  // Notification
  message?: string;
  notification_type?: string;

  // Stop / SubagentStop
  stop_hook_active?: boolean;

  // PermissionRequest
  permission_suggestions?: unknown[];

  // Notification
  title?: string;

  // SubagentStart / SubagentStop
  agent_id?: string;
  agent_type?: string;
  agent_transcript_path?: string;

  // TaskCompleted
  task_id?: string;
  task_subject?: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;

  // SessionStart
  source?: string;

  // SessionEnd
  reason?: string;

  // UserPromptSubmit
  prompt?: string;
}

function basename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function generatePreToolUseMessage(input: HookInput): string {
  const toolName = input.tool_name ?? "不明";
  const toolInput = input.tool_input ?? {};

  switch (toolName) {
    case "Bash": {
      const desc = toolInput["description"];
      if (typeof desc === "string" && desc.length > 0) {
        return `コマンドを実行します。${desc}`;
      }
      return "コマンドを実行します";
    }
    case "Read": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を読み取ります`;
      }
      return "ファイルを読み取ります";
    }
    case "Write": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を作成します`;
      }
      return "ファイルを作成します";
    }
    case "Edit": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を編集します`;
      }
      return "ファイルを編集します";
    }
    case "Grep": {
      const pattern = toolInput["pattern"];
      if (typeof pattern === "string") {
        return `${pattern} を検索します`;
      }
      return "コード検索を実行します";
    }
    case "Glob": {
      const pattern = toolInput["pattern"];
      if (typeof pattern === "string") {
        return `${pattern} でファイルを検索します`;
      }
      return "ファイル検索を実行します";
    }
    case "Task": {
      const desc = toolInput["description"];
      if (typeof desc === "string" && desc.length > 0) {
        return `サブエージェントを起動します。${desc}`;
      }
      return "サブエージェントを起動します";
    }
    case "WebFetch":
      return "Webページを取得します";
    case "WebSearch": {
      const query = toolInput["query"];
      if (typeof query === "string") {
        return `${query} をWeb検索します`;
      }
      return "Web検索を実行します";
    }
    default:
      return `${toolName} を実行します`;
  }
}

function generatePostToolUseMessage(input: HookInput): string {
  const toolName = input.tool_name ?? "不明";
  const toolInput = input.tool_input ?? {};

  switch (toolName) {
    case "Bash":
      return "コマンドが完了しました";
    case "Read": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} の読み取りが完了しました`;
      }
      return "ファイルの読み取りが完了しました";
    }
    case "Write": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を作成しました`;
      }
      return "ファイルを作成しました";
    }
    case "Edit": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} の編集が完了しました`;
      }
      return "ファイルの編集が完了しました";
    }
    case "Grep":
      return "コード検索が完了しました";
    case "Glob":
      return "ファイル検索が完了しました";
    case "Task":
      return "サブエージェントが完了しました";
    case "WebFetch":
      return "Webページの取得が完了しました";
    case "WebSearch":
      return "Web検索が完了しました";
    default:
      return `${toolName} が完了しました`;
  }
}

function generatePermissionRequestMessage(input: HookInput): string {
  const toolName = input.tool_name ?? "不明";
  const toolInput = input.tool_input ?? {};

  switch (toolName) {
    case "Bash": {
      const desc = toolInput["description"];
      if (typeof desc === "string" && desc.length > 0) {
        return `コマンドの実行許可が必要です。${desc}`;
      }
      return "コマンドの実行許可が必要です";
    }
    case "Read": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} の読み取り許可が必要です`;
      }
      return "ファイルの読み取り許可が必要です";
    }
    case "Write": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} の作成許可が必要です`;
      }
      return "ファイルの作成許可が必要です";
    }
    case "Edit": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} の編集許可が必要です`;
      }
      return "ファイルの編集許可が必要です";
    }
    case "Task": {
      const desc = toolInput["description"];
      if (typeof desc === "string" && desc.length > 0) {
        return `サブエージェントの起動許可が必要です。${desc}`;
      }
      return "サブエージェントの起動許可が必要です";
    }
    case "WebFetch":
      return "Webページ取得の許可が必要です";
    case "WebSearch":
      return "Web検索の許可が必要です";
    default:
      return `${toolName} の実行許可が必要です`;
  }
}

function generateNotificationMessage(input: HookInput): string {
  const message = input.message ?? "";
  const title = input.title ?? "";
  switch (input.notification_type) {
    case "permission_prompt":
      if (title.length > 0) {
        return `許可が必要です。${title}`;
      }
      return "許可が必要です";
    case "idle_prompt":
      return "入力を待っています";
    default:
      if (title.length > 0 && message.length > 0) {
        return `通知: ${title}。${message}`;
      }
      if (message.length > 0) {
        return `通知: ${message}`;
      }
      if (title.length > 0) {
        return `通知: ${title}`;
      }
      return "通知があります";
  }
}

function generateSubagentStartMessage(input: HookInput): string {
  const agentType = input.agent_type ?? "不明";
  return `${agentType} エージェントを起動しました`;
}

function generateSubagentStopMessage(input: HookInput): string | null {
  if (input.stop_hook_active) {
    return null;
  }
  const agentType = input.agent_type ?? "不明";
  return `${agentType} エージェントが完了しました`;
}

function generateTaskCompletedMessage(input: HookInput): string {
  const subject = input.task_subject;
  if (typeof subject === "string" && subject.length > 0) {
    return `タスク完了: ${subject}`;
  }
  return "タスクが完了しました";
}

function generateSessionStartMessage(input: HookInput): string {
  switch (input.source) {
    case "resume":
      return "セッションを再開しました";
    case "clear":
      return "セッションをクリアしました";
    case "compact":
      return "コンテキストを圧縮しました";
    default:
      return "セッションを開始しました";
  }
}

export function generateMessage(input: HookInput): string | null {
  switch (input.hook_event_name) {
    case "PreToolUse":
      return generatePreToolUseMessage(input);
    case "PostToolUse":
      return generatePostToolUseMessage(input);
    case "PostToolUseFailure":
      return `${input.tool_name ?? "ツール"} が失敗しました`;
    case "PermissionRequest":
      return generatePermissionRequestMessage(input);
    case "Notification":
      return generateNotificationMessage(input);
    case "SubagentStart":
      return generateSubagentStartMessage(input);
    case "SubagentStop":
      return generateSubagentStopMessage(input);
    case "Stop":
      if (input.stop_hook_active) {
        return null;
      }
      return "処理が完了しました";
    case "TaskCompleted":
      return generateTaskCompletedMessage(input);
    case "SessionStart":
      return generateSessionStartMessage(input);
    case "SessionEnd":
      return "セッションを終了します";
    case "UserPromptSubmit":
      return "プロンプトを受け付けました";
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
  const input = JSON.parse(raw) as HookInput;
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
