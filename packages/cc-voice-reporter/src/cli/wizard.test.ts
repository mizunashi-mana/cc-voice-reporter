import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWizard } from './wizard.js';
import type { WizardIO } from './wizard.js';

/** Create a mock WizardIO that returns pre-defined answers in order. */
function createMockIO(answers: string[]): WizardIO & { output: string[] } {
  const queue = [...answers];
  const output: string[] = [];
  return {
    output,
    question: vi.fn(async () => queue.shift() ?? ''),
    write: vi.fn((msg: string) => { output.push(msg); }),
    close: vi.fn(),
  };
}

describe('runWizard', () => {
  beforeEach(() => {
    vi.mock('./locale.js', () => ({
      detectSystemLanguage: vi.fn(() => 'ja'),
    }));
    vi.mock('./speaker-command.js', () => ({
      detectSpeakerCommand: vi.fn((): [string] => ['say']),
    }));
    vi.mock('./ollama.js', () => ({
      listOllamaModels: vi.fn(async () => ['gemma3:latest', 'llama3:latest']),
      OLLAMA_DEFAULT_BASE_URL: 'http://localhost:11434',
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates config with all defaults accepted', async () => {
    // Answers: language(default), use detected speaker(Y), ollama url(default), model(default), confirm(Y)
    const io = createMockIO(['', 'y', '', '', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config).toEqual({
      language: 'ja',
      speaker: { command: ['say'] },
      ollama: { model: 'gemma3:latest' },
    });
  });

  it('allows custom language', async () => {
    const io = createMockIO(['en', 'y', '', '', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config.language).toBe('en');
  });

  it('allows custom speaker command when user declines detected one', async () => {
    // Decline detected speaker, enter custom command
    const io = createMockIO(['', 'n', 'espeak-ng', '', '', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config.speaker).toEqual({ command: ['espeak-ng'] });
  });

  it('allows custom Ollama model selection', async () => {
    const io = createMockIO(['', 'y', '', 'llama3:latest', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config.ollama).toEqual({ model: 'llama3:latest' });
  });

  it('includes baseUrl when non-default', async () => {
    const io = createMockIO(['', 'y', 'http://remote:11434', '', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config.ollama).toEqual({
      model: 'gemma3:latest',
      baseUrl: 'http://remote:11434',
    });
  });

  it('returns confirmed=false when user declines', async () => {
    const io = createMockIO(['', 'y', '', '', 'n']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(false);
  });

  it('shows install guidance when Ollama is unreachable', async () => {
    const { listOllamaModels } = await import('./ollama.js');
    vi.mocked(listOllamaModels).mockRejectedValue(new Error('ECONNREFUSED'));

    // language, use speaker(Y), ollama url(default), model name, confirm
    const io = createMockIO(['', 'y', '', 'gemma3', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config.ollama).toEqual({ model: 'gemma3' });
    // Check that install instructions were shown
    const allOutput = io.output.join('');
    expect(allOutput).toContain('Could not connect to Ollama');
    expect(allOutput).toContain('ollama pull gemma3');
  });

  it('shows guidance when Ollama has no models', async () => {
    const { listOllamaModels } = await import('./ollama.js');
    vi.mocked(listOllamaModels).mockResolvedValue([]);

    const io = createMockIO(['', 'y', '', 'gemma3', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    const allOutput = io.output.join('');
    expect(allOutput).toContain('no models are available');
  });

  it('handles no TTS command detected', async () => {
    const { detectSpeakerCommand } = await import('./speaker-command.js');
    vi.mocked(detectSpeakerCommand).mockImplementation(() => {
      throw new Error('No TTS command found');
    });

    // language, custom speaker command, ollama url, model, confirm
    const io = createMockIO(['', 'espeak-ng', '', '', 'y']);

    const result = await runWizard(io);

    expect(result.confirmed).toBe(true);
    expect(result.config.speaker).toEqual({ command: ['espeak-ng'] });
  });

  it('shows generated config JSON before confirmation', async () => {
    const io = createMockIO(['', 'y', '', '', 'y']);

    await runWizard(io);

    const allOutput = io.output.join('');
    expect(allOutput).toContain('Generated config');
    expect(allOutput).toContain('"language"');
    expect(allOutput).toContain('"speaker"');
    expect(allOutput).toContain('"ollama"');
  });
});
