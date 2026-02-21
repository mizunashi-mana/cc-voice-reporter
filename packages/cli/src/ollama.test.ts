import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveOllamaModel } from './ollama.js';

describe('resolveOllamaModel', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Default mock: return empty models list
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchModels(models: string[]): void {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: models.map(name => ({ name })),
        }),
        { status: 200 },
      ),
    );
  }

  function mockFetchError(): void {
    vi.mocked(globalThis.fetch).mockRejectedValue(
      new Error('fetch failed'),
    );
  }

  it('returns undefined when ollama is not configured', async () => {
    const result = await resolveOllamaModel({});
    expect(result).toBeUndefined();
  });

  it('auto-detects first available model when not specified', async () => {
    mockFetchModels(['gemma3:latest', 'llama3:latest']);
    const result = await resolveOllamaModel({
      ollama: {},
    });
    expect(result).toBe('gemma3:latest');
  });

  it('validates specified model exists (exact match)', async () => {
    mockFetchModels(['gemma3:latest', 'llama3:latest']);
    const result = await resolveOllamaModel({
      ollama: { model: 'gemma3:latest' },
    });
    expect(result).toBe('gemma3:latest');
  });

  it('validates specified model exists (base name match)', async () => {
    mockFetchModels(['gemma3:latest', 'llama3:latest']);
    const result = await resolveOllamaModel({
      ollama: { model: 'gemma3' },
    });
    expect(result).toBe('gemma3');
  });

  it('throws when specified model is not available', async () => {
    mockFetchModels(['gemma3:latest']);
    await expect(
      resolveOllamaModel({
        ollama: { model: 'nonexistent' },
      }),
    ).rejects.toThrow('not available');
  });

  it('throws when no models available for auto-detect', async () => {
    mockFetchModels([]);
    await expect(
      resolveOllamaModel({
        ollama: {},
      }),
    ).rejects.toThrow('No Ollama models available');
  });

  it('throws when Ollama API is unreachable', async () => {
    mockFetchError();
    await expect(
      resolveOllamaModel({
        ollama: {},
      }),
    ).rejects.toThrow('Failed to connect to Ollama');
  });

  it('uses custom baseUrl from config', async () => {
    mockFetchModels(['gemma3:latest']);
    await resolveOllamaModel({
      ollama: { baseUrl: 'http://custom:9999' },
    });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'http://custom:9999/api/tags',
    );
  });
});
