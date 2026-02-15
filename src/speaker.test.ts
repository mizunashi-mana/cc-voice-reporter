import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { type ChildProcess } from "node:child_process";
import { Speaker } from "./speaker.js";

/** Create a fake ChildProcess that can be resolved manually. */
function createFakeProcess(): {
  process: ChildProcess;
  killSpy: ReturnType<typeof vi.fn>;
  finish: () => void;
  fail: (error: Error) => void;
} {
  const emitter = new EventEmitter();
  const proc = emitter as unknown as ChildProcess;
  const killSpy = vi.fn(() => true);
  proc.kill = killSpy;

  return {
    process: proc,
    killSpy,
    finish: () => emitter.emit("close", 0, null),
    fail: (error: Error) => emitter.emit("error", error),
  };
}

describe("Speaker", () => {
  let processes: ReturnType<typeof createFakeProcess>[];
  let executorSpy: ReturnType<typeof vi.fn>;
  let speaker: Speaker;

  function setup(options?: { maxLength?: number; truncationSuffix?: string }) {
    processes = [];
    executorSpy = vi.fn(() => {
      const fp = createFakeProcess();
      processes.push(fp);
      return fp.process;
    });
    speaker = new Speaker({
      executor: executorSpy,
      ...options,
    });
  }

  afterEach(() => {
    speaker?.dispose();
  });

  describe("speak", () => {
    it("executes the first message immediately", () => {
      setup();
      speaker.speak("こんにちは");
      expect(executorSpy).toHaveBeenCalledOnce();
      expect(executorSpy).toHaveBeenCalledWith("こんにちは");
    });

    it("queues subsequent messages until the current one finishes", () => {
      setup();
      speaker.speak("1つ目");
      speaker.speak("2つ目");
      speaker.speak("3つ目");

      expect(executorSpy).toHaveBeenCalledOnce();
      expect(speaker.pending).toBe(2);
    });

    it("processes the next message after the current one finishes", () => {
      setup();
      speaker.speak("1つ目");
      speaker.speak("2つ目");

      expect(executorSpy).toHaveBeenCalledTimes(1);

      processes[0]!.finish();

      expect(executorSpy).toHaveBeenCalledTimes(2);
      expect(executorSpy).toHaveBeenLastCalledWith("2つ目");
      expect(speaker.pending).toBe(0);
    });

    it("processes all queued messages in order", () => {
      setup();
      speaker.speak("A");
      speaker.speak("B");
      speaker.speak("C");

      processes[0]!.finish();
      processes[1]!.finish();
      processes[2]!.finish();

      expect(executorSpy).toHaveBeenCalledTimes(3);
      expect(executorSpy.mock.calls.map((c) => String(c[0]))).toEqual([
        "A",
        "B",
        "C",
      ]);
    });

    it("continues processing after an error", () => {
      setup();
      speaker.speak("失敗するメッセージ");
      speaker.speak("成功するメッセージ");

      processes[0]!.fail(new Error("say failed"));

      expect(executorSpy).toHaveBeenCalledTimes(2);
      expect(executorSpy).toHaveBeenLastCalledWith("成功するメッセージ");
    });

    it("does not break exclusion when error and close both fire", () => {
      setup();
      speaker.speak("A");
      speaker.speak("B");
      speaker.speak("C");

      // Simulate spawn failure: error fires, then close fires
      processes[0]!.fail(new Error("spawn ENOENT"));
      processes[0]!.finish(); // close fires after error — should be ignored

      // "B" should be running, "C" still queued
      expect(executorSpy).toHaveBeenCalledTimes(2);
      expect(speaker.pending).toBe(1);

      processes[1]!.finish();
      expect(executorSpy).toHaveBeenCalledTimes(3);
      expect(executorSpy).toHaveBeenLastCalledWith("C");
    });

    it("is a no-op after dispose", () => {
      setup();
      speaker.dispose();
      speaker.speak("無視されるメッセージ");

      expect(executorSpy).not.toHaveBeenCalled();
      expect(speaker.pending).toBe(0);
    });
  });

  describe("truncation", () => {
    it("does not truncate messages within maxLength", () => {
      setup({ maxLength: 10 });
      speaker.speak("12345");
      expect(executorSpy).toHaveBeenCalledWith("12345");
    });

    it("does not truncate messages exactly at maxLength", () => {
      setup({ maxLength: 5 });
      speaker.speak("12345");
      expect(executorSpy).toHaveBeenCalledWith("12345");
    });

    it("truncates messages exceeding maxLength with default suffix", () => {
      setup({ maxLength: 5 });
      speaker.speak("123456789");
      expect(executorSpy).toHaveBeenCalledWith("12345、以下省略");
    });

    it("truncates with custom suffix", () => {
      setup({ maxLength: 5, truncationSuffix: "..." });
      speaker.speak("123456789");
      expect(executorSpy).toHaveBeenCalledWith("12345...");
    });

    it("uses default maxLength of 200", () => {
      setup();
      const longMessage = "あ".repeat(201);
      speaker.speak(longMessage);
      const called = executorSpy.mock.calls[0]![0] as string;
      expect(called).toBe("あ".repeat(200) + "、以下省略");
    });

    it("does not truncate at exactly 200 characters", () => {
      setup();
      const exactMessage = "あ".repeat(200);
      speaker.speak(exactMessage);
      expect(executorSpy).toHaveBeenCalledWith(exactMessage);
    });
  });

  describe("isSpeaking", () => {
    it("is false when idle", () => {
      setup();
      expect(speaker.isSpeaking).toBe(false);
    });

    it("is true while speaking", () => {
      setup();
      speaker.speak("テスト");
      expect(speaker.isSpeaking).toBe(true);
    });

    it("is false after speech finishes", () => {
      setup();
      speaker.speak("テスト");
      processes[0]!.finish();
      expect(speaker.isSpeaking).toBe(false);
    });
  });

  describe("pending", () => {
    it("is 0 when idle", () => {
      setup();
      expect(speaker.pending).toBe(0);
    });

    it("counts only queued messages, not the current one", () => {
      setup();
      speaker.speak("current");
      expect(speaker.pending).toBe(0);

      speaker.speak("queued1");
      speaker.speak("queued2");
      expect(speaker.pending).toBe(2);
    });

    it("decreases as messages are processed", () => {
      setup();
      speaker.speak("A");
      speaker.speak("B");
      speaker.speak("C");

      expect(speaker.pending).toBe(2);
      processes[0]!.finish();
      expect(speaker.pending).toBe(1);
      processes[1]!.finish();
      expect(speaker.pending).toBe(0);
    });
  });

  describe("clear", () => {
    it("removes all queued messages", () => {
      setup();
      speaker.speak("current");
      speaker.speak("queued1");
      speaker.speak("queued2");

      speaker.clear();

      expect(speaker.pending).toBe(0);
      expect(speaker.isSpeaking).toBe(true); // current still playing
    });

    it("does not start new messages after clear", () => {
      setup();
      speaker.speak("current");
      speaker.speak("queued");

      speaker.clear();
      processes[0]!.finish();

      expect(executorSpy).toHaveBeenCalledTimes(1);
      expect(speaker.isSpeaking).toBe(false);
    });
  });

  describe("dispose", () => {
    it("kills the current process", () => {
      setup();
      speaker.speak("テスト");

      speaker.dispose();

      expect(processes[0]!.killSpy).toHaveBeenCalled();
    });

    it("clears the queue", () => {
      setup();
      speaker.speak("current");
      speaker.speak("queued");

      speaker.dispose();

      expect(speaker.pending).toBe(0);
    });

    it("sets isSpeaking to false", () => {
      setup();
      speaker.speak("テスト");

      speaker.dispose();

      expect(speaker.isSpeaking).toBe(false);
    });

    it("is safe to call when idle", () => {
      setup();
      expect(() => speaker.dispose()).not.toThrow();
    });

    it("is safe to call multiple times", () => {
      setup();
      speaker.speak("テスト");
      speaker.dispose();
      expect(() => speaker.dispose()).not.toThrow();
    });
  });
});
