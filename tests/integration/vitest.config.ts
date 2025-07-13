import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    testTimeout: 30000,
    setupFiles: ['./setup.ts'],
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'setup.ts',
        'vitest.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src'),
      '@models': resolve(__dirname, '../../packages/core/src/models'),
      '@cache': resolve(__dirname, '../../packages/core/src/cache'),
      '@evaluator': resolve(__dirname, '../../packages/core/src/evaluator')
    }
  }
});