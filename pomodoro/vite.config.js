/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /*
     * The API is same-origin in every environment. Production gets that from the Netlify /api/*
     * rewrite; this proxy is its development equivalent. Calling http://localhost:3000 directly
     * instead would make every request cross-origin and require the API's CORS allowlist to
     * cover the dev server on every port it might use.
     */
    proxy: {
      '/api': { target: 'http://localhost:3000' },
    },
  },
  test: {
    // Jest-like global APIs (describe/it/expect) — also lets Testing Library
    // register its automatic DOM cleanup between tests.
    globals: true,
    // Component tests need a DOM; jsdom supplies document/window in Node.
    environment: 'jsdom',
    // Registers the jest-dom matchers once for every test file.
    setupFiles: ['./src/tests/setup.js'],
    // Restore spies/mocks between tests so state cannot leak across files.
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/tests/**', 'src/**/*.test.{js,jsx}'],
    },
  },
});
