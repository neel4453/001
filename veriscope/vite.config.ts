import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// The product name is injected at build time from package.json "productName",
// so branding can be changed in one place without touching source (spec: branding must be safe to rename).
export default defineConfig({
  base: './',
  define: {
    __APP_NAME__: JSON.stringify(pkg.productName ?? pkg.name),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  build: {
    target: 'chrome120',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        popup: 'popup.html',
        sidepanel: 'sidepanel.html',
        options: 'options.html',
      },
    },
  },
});
