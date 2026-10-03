import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { applyTheme, readTheme } from './pages/Profile';
import { consumeOAuthCallback } from './lib/github';
import { login, startSync, useAuth } from './lib/sync';
// Typographies auto-hébergées (hors-ligne, sans appel à Google Fonts) : Barlow pour le texte,
// Barlow Condensed pour les titres, le logo et les chiffres.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import './styles.css';

// Anti-clickjacking : l'app refuse de s'afficher dans le cadre (iframe) d'un autre site,
// qui pourrait faire cliquer à l'aveugle sur « Partager » ou « Tout effacer ».
if (window.top !== window.self) {
  const p = document.createElement('p');
  p.style.cssText = 'font:16px system-ui;padding:24px';
  const a = document.createElement('a');
  a.href = window.location.href;
  a.target = '_top';
  a.textContent = 'Ouvrir New Shape';
  p.append('Pour ta sécurité, New Shape ne s’affiche pas à l’intérieur d’un autre site. ', a);
  document.body.replaceChildren(p);
  throw new Error('New Shape : affichage dans un cadre refusé');
}

applyTheme(readTheme());

// Retour de la page d'autorisation GitHub (?code=…) : l'URL est nettoyée avant le premier rendu,
// puis le code est échangé contre un jeton et la première synchro démarre.
consumeOAuthCallback()
  .then((token) => (token ? login(token) : undefined))
  .catch((e: Error) => useAuth.setState({ status: 'error', error: e.message }));
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
