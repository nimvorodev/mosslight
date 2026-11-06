import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite's React plugin injects a tiny inline preamble in dev. The production CSP
 * stays strict; in dev we allow that one inline script so refresh works.
 */
function devCsp(): Plugin {
  return {
    name: 'mosslight-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), devCsp()],
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome130',
  },
});
