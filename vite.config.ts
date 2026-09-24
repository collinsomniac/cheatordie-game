import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cheatordie-game/',
  build: {
    target: 'es2022',
    sourcemap: true,
    license: true,
    chunkSizeWarningLimit: 900,
  },
});
