import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov']
    },
    testTimeout: 15000
  },
  resolve: {
    alias: {
      '@inno-optimize/agentdb': path.resolve(__dirname, '../agentdb/src'),
      '@inno-optimize/mcp-framework': path.resolve(__dirname, '../mcp-framework/src'),
      '@inno-optimize/intelligence': path.resolve(__dirname, '../intelligence/src'),
      '@inno-optimize/coordination': path.resolve(__dirname, '../coordination/src'),
      '@inno-optimize/ast-analysis': path.resolve(__dirname, '../ast-analysis/src'),
      '@inno-optimize/optimization': path.resolve(__dirname, './src')
    }
  }
});