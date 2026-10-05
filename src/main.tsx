import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { applyTheme, readTheme } from './pages/Profile';
import { consumeAuthReturn } from './lib/api';
import { afterSignIn, applyGistImport, startSync, useAuth } from './lib/sync';
import { startTransferReceiver } from './lib/transfer';
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

// Retour de GitHub (?auth=… ou ?auth_error=…) : l'adresse est nettoyée avant le premier rendu,
// puis le compte est chargé, la synchro démarre et un éventuel import de l'ancien gist est fusionné.
const authReturn = consumeAuthReturn();
startSync();
startTransferReceiver();
if (authReturn?.error) useAuth.setState({ status: 'error', error: authReturn.error });
else if (authReturn?.mode) {
  void afterSignIn()
    .then(async () => {
      if (authReturn.mode !== 'import') return;
      const done = authReturn.imported === 'ok' && (await applyGistImport());
      useAuth.setState({ notice: done ? 'Données de l’ancien gist importées ✓' : 'Aucune donnée New Shape trouvée dans tes gists.' });
    })
    .catch((e: Error) => useAuth.setState({ status: 'error', error: e.message }));
}

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
