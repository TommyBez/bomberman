import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the production build runs from any sub-path (GitHub Pages, itch.io, a local file server).
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
