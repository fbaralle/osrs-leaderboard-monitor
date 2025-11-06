/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // eslint-disable-next-line
    swc.vite({
      // Explicitly set the module type to avoid inheriting this value from a `.swcrc` config file
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.spec.ts', 'test/**/*.e2e.spec.ts'],
    reporters: 'default',
    root: './',
  },
  resolve: {
    alias: {
      // Ensure Vitest correctly resolves TypeScript path aliases
      src: resolve(__dirname, './src'),
    },
  },
});
