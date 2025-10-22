import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'tests/**/*.test.ts',
      'src/**/*.test.ts',
      'functions/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'scripts/',
        '.loom/worktrees/',
        '**/*.config.{ts,js,mjs}',
        '**/*.test.{ts,tsx}',
        '**/types.ts',
      ],
    },
  },
})
