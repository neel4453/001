import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Service worker: single self-contained ES module (MV3 requirement: no dynamic chunk loading
// in workers; we inline everything).
export default defineConfig({
  define: {
    __APP_NAME__: JSON.stringify(pkg.productName ?? pkg.name),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'chrome120',
    sourcemap: false,
    emptyOutDir: false,
    lib: {
      entry: 'src/background/service-worker.ts',
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
