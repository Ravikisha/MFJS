import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Individual packages can override this with their own vitest.config.ts.
    // Root-level discovery deliberately excludes example workspaces — they
    // own their own vitest configs and depend on prebuilt CLI artifacts.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-ssg/**',
      '**/examples/**',
      '**/docs/**',
      '**/.next/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: ['libs/**/src/**/*.{ts,tsx}', 'packages/**/src/**/*.{ts,tsx}'],
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/examples/**',
        '**/docs/**',
        '**/*.d.ts',
        '**/test/**',
      ],
    },
  },
});
