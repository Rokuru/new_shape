import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readTheme } from './pages/Profile';
import { consumeOAuthCallback } from './lib/github';
import { login, startSync, useAuth } from './lib/sync';
import './styles.css';

applyTheme(readTheme());

// Retour de la page d'autorisation GitHub (?code=…) : l'URL est nettoyée avant le premier rendu,
// puis le code est échangé contre un jeton et la première synchro démarre.
consumeOAuthCallback()
  .then((token) => (token ? login(token) : undefined))
  .catch((e: Error) => useAuth.setState({ status: 'error', error: e.message }));
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
