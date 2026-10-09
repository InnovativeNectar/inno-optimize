import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/__tests__/**',
        '**/*.d.ts',
        '**/__mocks__/**'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    }
  },
  resolve: {
    alias: {
      '@inno-optimize/agentdb': path.resolve(__dirname, 'packages/agentdb/src'),
      '@inno-optimize/mcp-framework': path.resolve(__dirname, 'packages/mcp-framework/src'),
      '@inno-optimize/adr-automation': path.resolve(__dirname, 'packages/adr-automation/src'),
      '@inno-optimize/ast-analysis': path.resolve(__dirname, 'packages/ast-analysis/src')
    }
  }
});