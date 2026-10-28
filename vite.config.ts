/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * `import datos from './archivo.glb?base64'` devuelve el contenido en base64, igual en desarrollo,
 * en las pruebas y en la compilación. Así el modelo 3D se lee sin fetch (bloqueado en claude.ai).
 */
function base64(): Plugin {
  return {
    name: 'importar-base64',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('?base64')) return null;
      const archivo = id.slice(0, -'?base64'.length);
      return `export default ${JSON.stringify(readFileSync(archivo).toString('base64'))};`;
    },
  };
}

// `--mode artefacto` genera un único archivo JS (sin fragmentos separados)
// para poder publicarlo como página única en claude.ai.
export default defineConfig(({ mode }) => ({
  plugins: [react(), base64()],
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
