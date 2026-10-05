/**
 * Transfert depuis l'ancienne adresse (GitHub Pages) : chaque adresse a son propre stockage dans le navigateur,
 * les données locales de l'ancienne app ne sont donc pas visibles ici. La page de l'ancienne adresse ouvre
 * celle-ci avec #transfer et lui envoie ses données par postMessage.
 * Seuls les messages venant exactement de l'ancienne adresse sont acceptés, et tout est revalidé.
 */
import { mergeData, useAuth } from './sync';
import { pickSynced, sanitizeProfile, useStore, type SyncedData } from './store';
import { sanitizeCollections } from './sanitize';

export const LEGACY_ORIGIN = 'https://rokuru.github.io';

/** Données de l'ancienne app (état persistant), nettoyées comme un fichier importé. */
export function legacyToSynced(raw: unknown, keepShare: SyncedData['share']): SyncedData | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const d = raw as Record<string, unknown>;
  if (!d.profile || typeof d.profile !== 'object' || !Array.isArray(d.workouts) || !Array.isArray(d.body)) return undefined;
  const c = sanitizeCollections(d);
  return {
    onboarded: true,
    profile: sanitizeProfile(d.profile as never),
    body: c.body,
    workouts: c.workouts,
    customPrograms: c.customPrograms,
    activeProgramId: c.activeProgramId,
    nextDayIndex: c.nextDayIndex,
    kcalAdjust: c.kcalAdjust,
    kcalAdjustedAt: c.kcalAdjustedAt,
    deleted: c.deleted,
    friends: c.friends,
    cardio: c.cardio,
    food: c.food,
    // Un transfert ne doit jamais activer le partage : on garde le réglage d'ici.
    share: keepShare,
  };
}

export function startTransferReceiver() {
  if (window.location.hash !== '#transfer' || !window.opener) return;
  let done = false;
  const ping = setInterval(() => {
    try {
      window.opener?.postMessage({ type: 'ns-ready' }, LEGACY_ORIGIN);
    } catch {
      /* fenêtre d'origine fermée */
    }
  }, 400);
  setTimeout(() => clearInterval(ping), 30_000);

  window.addEventListener('message', (e: MessageEvent) => {
    if (done || e.origin !== LEGACY_ORIGIN) return;
    const msg = e.data as { type?: unknown; state?: unknown } | null;
    if (!msg || msg.type !== 'ns-transfer') return;
    done = true;
    clearInterval(ping);
    const store = useStore.getState();
    const incoming = legacyToSynced(msg.state, store.share);
    if (!incoming) {
      useAuth.setState({ notice: 'Transfert impossible : données de l’ancienne adresse illisibles. Utilise « Exporter » là-bas puis « Importer » ici.' });
      return;
    }
    // Déjà des données ici : fusion (rien n'est perdu, ce qui est ici l'emporte en cas de doublon).
    store.applySynced(store.onboarded ? mergeData(pickSynced(store), incoming, true) : incoming);
    (e.source as Window | null)?.postMessage({ type: 'ns-received' }, { targetOrigin: LEGACY_ORIGIN });
    useAuth.setState({ notice: `Données de l’ancienne adresse transférées ✓ (${incoming.workouts.length} séances, ${incoming.body.length} mesures)` });
    window.history.replaceState(null, '', window.location.pathname + '#profile');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
