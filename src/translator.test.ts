import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Translator } from "./translator.js";

describe("Translator", () => {
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createTranslator(options?: {
    model?: string;
    baseUrl?: string;
    outputLanguage?: string;
  }) {
    return new Translator(
      {
        outputLanguage: options?.outputLanguage ?? "ja",
        ollama: {
          model: options?.model ?? "gemma3",
          baseUrl: options?.baseUrl ?? "http://localhost:11434",
        },
      },
      (msg) => warnings.push(msg),
    );
  }

  describe("translate", () => {
    it("sends correct request to Ollama API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "こんにちは" },
          }),
          { status: 200 },
        ),
      );

      const translator = createTranslator({ model: "test-model" });
      await translator.translate("Hello");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("http://localhost:11434/api/chat");
      expect(init?.method).toBe("POST");

      const body = JSON.parse(init?.body as string) as {
        model: string;
        stream: boolean;
        messages: { role: string; content: string }[];
      };
      expect(body.model).toBe("test-model");
      expect(body.stream).toBe(false);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]!.role).toBe("system");
      expect(body.messages[0]!.content).toContain("ja");
      expect(body.messages[1]!.role).toBe("user");
      expect(body.messages[1]!.content).toBe("Hello");
    });

    it("returns translated text from Ollama response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "こんにちは" },
          }),
          { status: 200 },
        ),
      );

      const translator = createTranslator();
      const result = await translator.translate("Hello");
      expect(result).toBe("こんにちは");
    });

    it("trims whitespace from translated text", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "  こんにちは  \n" },
          }),
          { status: 200 },
        ),
      );

      const translator = createTranslator();
      const result = await translator.translate("Hello");
      expect(result).toBe("こんにちは");
    });

    it("uses custom baseUrl", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "translated" },
          }),
          { status: 200 },
        ),
      );

      const translator = createTranslator({
        baseUrl: "http://custom:9999",
      });
      await translator.translate("text");

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("http://custom:9999/api/chat");
    });

    it("returns original text on HTTP error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      const translator = createTranslator();
      const result = await translator.translate("original text");

      expect(result).toBe("original text");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("HTTP 500");
    });

    it("returns original text on invalid response format", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ unexpected: "format" }), {
          status: 200,
        }),
      );

      const translator = createTranslator();
      const result = await translator.translate("original text");

      expect(result).toBe("original text");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("invalid response format");
    });

    it("returns original text on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused"),
      );

      const translator = createTranslator();
      const result = await translator.translate("original text");

      expect(result).toBe("original text");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Connection refused");
    });

    it("passes AbortSignal to fetch for timeout", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "translated" },
          }),
          { status: 200 },
        ),
      );

      const translator = createTranslator();
      await translator.translate("test");

      const init = fetchSpy.mock.calls[0]![1];
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it("returns original text on abort (timeout)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new DOMException("The operation was aborted.", "AbortError"),
      );

      const translator = createTranslator();
      const result = await translator.translate("timeout text");

      expect(result).toBe("timeout text");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("aborted");
    });

    it("includes outputLanguage in system prompt", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "Hello" },
          }),
          { status: 200 },
        ),
      );

      const translator = createTranslator({ outputLanguage: "en" });
      await translator.translate("こんにちは");

      const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string) as {
        messages: { content: string }[];
      };
      expect(body.messages[0]!.content).toContain("en");
    });
  });
});
