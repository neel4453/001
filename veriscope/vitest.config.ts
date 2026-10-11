import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __APP_NAME__: JSON.stringify('VeriScope'),
    __APP_VERSION__: JSON.stringify('1.0.0-test'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
