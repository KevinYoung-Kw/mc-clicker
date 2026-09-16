import { defineConfig } from "vite";
import { RELEASE_NAME } from './src/release.js';

// The same static build can run at a domain root or a nested server directory.
export default defineConfig({
  base: "./",
  worker: { format: 'es' },
  // Preserve the WASM module's relative URL during local dependency optimization.
  optimizeDeps: { exclude: ['brotli-wasm'] },
  plugins: [{ name: 'mc-release-version', transformIndexHtml: html => html.replaceAll('__MC_RELEASE__', RELEASE_NAME) }],
  build: {
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { "three-engine": ["three"] } },
    },
  },
});
