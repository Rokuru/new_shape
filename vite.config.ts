import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Politique de sécurité du contenu (CSP), ajoutée à index.html au build (GitHub Pages ne permet pas d'en-têtes HTTP).
 * Seuls les scripts de l'app s'exécutent et les données ne peuvent partir que vers GitHub et le proxy OAuth :
 * même si un texte piégé arrivait à s'afficher, il ne pourrait ni lancer de script ni envoyer le jeton ailleurs.
 */
function csp(proxyUrl: string): Plugin {
  const proxy = proxyUrl ? new URL(proxyUrl).origin : '';
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "font-src 'self'",
    `connect-src 'self' https://api.github.com https://gist.githubusercontent.com${proxy ? ` ${proxy}` : ''}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'new-shape-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), csp(env.VITE_AUTH_PROXY_URL ?? '')],
    base: './',
    build: { chunkSizeWarningLimit: 900 },
  };
});
