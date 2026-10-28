/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode artefacto` genera un único archivo JS (sin fragmentos separados)
// para poder publicarlo como página única en claude.ai.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  server: { host: '127.0.0.1', port: 5173 },
  build:
    mode === 'artefacto'
      ? {
          outDir: 'dist-artefacto',
          // Todo embebido (también el modelo 3D) para publicar una sola página.
          assetsInlineLimit: () => true,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {},
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
}));
