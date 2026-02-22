import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['cc-voice-reporter-dev'],
  },
});
