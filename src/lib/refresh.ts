import { syncNow, useAuth } from './sync';

/** Script principal de la version actuellement chargée (ex. ./assets/index-AbC123.js). */
function currentBundle(): string | undefined {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src, location.href).pathname : undefined;
}

/**
 * Cherche une nouvelle version publiée. Si elle existe, ses fichiers sont téléchargés tout de suite
 * (le service worker les met en cache) pour que le rechargement qui suit soit quasi instantané.
 */
export async function fetchNewVersion(): Promise<boolean> {
  const current = currentBundle();
  if (!current) return false; // mode développement
  try {
    const res = await fetch(`./?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const script = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')?.getAttribute('src');
    if (!script || new URL(script, location.href).pathname === current) return false;
    const assets = [script, ...[...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href') ?? '')].filter(Boolean);
    await Promise.all(assets.map((a) => fetch(new URL(a, location.href)).then((r) => r.blob())));
    return true;
  } catch {
    return false; // hors connexion : on garde la version actuelle
  }
}

const isEditing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};

/**
 * « Tirer pour actualiser » : synchronise les données (GitHub) et installe la nouvelle version si besoin.
 * Aucune perte : les données sont enregistrées en continu (séance en cours comprise) et envoyées
 * avant le rechargement ; si un champ est en cours de saisie, le rechargement attend qu'il soit quitté.
 */
export async function refreshApp(): Promise<'updated' | 'synced'> {
  const [hasUpdate] = await Promise.all([fetchNewVersion(), useAuth.getState().token ? syncNow() : Promise.resolve()]);
  if (!hasUpdate) return 'synced';
  // Modifications locales pas encore envoyées (envoi groupé différé) : on les pousse avant de recharger.
  if (useAuth.getState().token && useAuth.getState().dirtyAt) await syncNow();
  if (isEditing()) document.addEventListener('focusout', () => setTimeout(() => !isEditing() && location.reload(), 0), { once: true });
  else location.reload();
  return 'updated';
}
