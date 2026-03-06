import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // event-bus.types.test.ts is a compile-time type test checked by `tsc --noEmit`.
    // It contains no describe/it blocks and should not be run by vitest.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.types.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['**/dist/**', '**/node_modules/**', '**/*.types.test.ts'],
    },
  },
});
