import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Politique de sécurité du contenu (CSP), dans index.html et en en-tête HTTP (public/_headers, Cloudflare).
 * Seuls les scripts de l'app s'exécutent et les requêtes ne peuvent partir que vers son propre serveur :
 * même si un texte piégé arrivait à s'afficher, il ne pourrait ni lancer de script ni envoyer de données ailleurs.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * En-têtes HTTP de Cloudflare Pages (fichier _headers) : la CSP en vrai en-tête permet frame-ancestors
 * (interdit l'affichage dans un cadre d'un autre site), plus quelques protections classiques.
 */
const HEADERS = `/*
  Content-Security-Policy: ${CSP}; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
`;

function csp(): Plugin {
  const policy = CSP;
  return {
    name: 'new-shape-csp',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
    },
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  plugins: [react(), csp()],
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
