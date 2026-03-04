import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Individual packages can override this with their own vitest.config.ts.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['**/dist/**', '**/node_modules/**', '**/examples/**', '**/docs/**']
    }
  }
});
