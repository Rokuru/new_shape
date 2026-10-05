import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, ApiError, fetchMe, type AppUser, type PasskeyInfo } from './api';
import { pickSynced, SYNCED_KEYS, useStore, type SyncedData } from './store';
import { publishShare, refreshFriends, useFriends, usePublish } from './share';

/** Contenu enregistré sur le serveur : les données + la date de la dernière modification. */
export interface SyncPayload {
  app: 'new-shape';
  version: 1;
  updatedAt: string;
  data: SyncedData;
}

type Status = 'idle' | 'syncing' | 'ok' | 'error';

interface AuthState {
  /** Utilisateur connecté (la session elle-même est un cookie HttpOnly, invisible ici). */
  user?: AppUser;
  passkeys?: PasskeyInfo[];
  githubConfigured?: boolean;
  /** Version serveur des données déjà intégrée localement (0 : rien sur le serveur). */
  version?: number;
  /** Date de la dernière modification locale non encore envoyée. */
  dirtyAt?: string;
  status: Status;
  error?: string;
  /** Message d'information ponctuel (import terminé…), non conservé. */
  notice?: string;
  lastSyncAt?: string;
}

export const useAuth = create<AuthState>()(
  persist((): AuthState => ({ status: 'idle' }), {
    name: 'new-shape-session',
    partialize: ({ user, version, dirtyAt, lastSyncAt }) => ({ user, version, dirtyAt, lastSyncAt }),
  }),
);

export const isSignedIn = () => Boolean(useAuth.getState().user);

// ---------- Fusion ----------

type WithId = { id: string };

function unionById<T extends WithId>(newer: T[], older: T[], deleted: Set<string>): T[] {
  const map = new Map<string, T>();
  for (const x of older) if (!deleted.has(x.id)) map.set(x.id, x);
  for (const x of newer) if (!deleted.has(x.id)) map.set(x.id, x);
  return [...map.values()];
}

/**
 * Fusionne deux versions modifiées en parallèle (ex. téléphone hors-ligne + ordinateur) :
 * - séances, mesures et programmes : union, sans ressusciter ce qui a été supprimé ;
 * - une seule mesure par jour (celle de la version la plus récente) ;
 * - profil et réglages : ceux de la version la plus récente.
 */
export function mergeData(local: SyncedData, remote: SyncedData, localIsNewer: boolean): SyncedData {
  const [newer, older] = localIsNewer ? [local, remote] : [remote, local];
  const deleted = new Set([...(local.deleted ?? []), ...(remote.deleted ?? [])]);
  const bodyByDate = new Map<string, SyncedData['body'][number]>();
  for (const e of [...older.body, ...newer.body]) if (!deleted.has(e.id)) bodyByDate.set(e.date, e);
  return {
    ...newer,
    onboarded: local.onboarded || remote.onboarded,
    deleted: [...deleted],
    body: [...bodyByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    workouts: unionById(newer.workouts, older.workouts, deleted).sort((a, b) => a.date.localeCompare(b.date)),
    cardio: unionById(newer.cardio ?? [], older.cardio ?? [], deleted).sort((a, b) => a.date.localeCompare(b.date)),
    food: unionById(newer.food ?? [], older.food ?? [], deleted),
    customPrograms: unionById(newer.customPrograms, older.customPrograms, deleted),
  };
}

export function parsePayload(text: string | undefined): SyncPayload | undefined {
  if (!text) return undefined;
  try {
    const p = JSON.parse(text) as SyncPayload;
    return p?.app === 'new-shape' && p.data && Array.isArray(p.data.workouts) ? p : undefined;
  } catch {
    return undefined;
  }
}

// ---------- Moteur de synchronisation ----------

let applying = false;
let running: Promise<void> | undefined;
let pending = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const hasLocalData = () => useStore.getState().onboarded;

function applyLocal(data: SyncedData) {
  applying = true;
  try {
    useStore.getState().applySynced(data);
  } finally {
    applying = false;
  }
}

const payloadOf = (data: SyncedData, updatedAt: string): string => JSON.stringify({ app: 'new-shape', version: 1, updatedAt, data } satisfies SyncPayload);

interface Remote {
  version: number;
  payload?: string;
}

/** Session terminée côté serveur (expirée, déconnectée ailleurs, compte supprimé). */
function signedOut() {
  useAuth.setState({ user: undefined, passkeys: undefined, version: undefined, status: 'idle', error: 'Session expirée : reconnecte-toi.' });
}

async function syncOnce() {
  if (!isSignedIn()) return;
  useAuth.setState({ status: 'syncing', error: undefined });
  try {
    let remoteRow = await api<Remote>('/data');
    // Jusqu'à 3 essais : un autre appareil peut écrire entre notre lecture et notre écriture (conflit 409).
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = parsePayload(remoteRow.payload);
      const { version, dirtyAt } = useAuth.getState();
      const local = pickSynced(useStore.getState());
      // Premier lien d'un appareil qui a déjà des données : elles sont à fusionner.
      const localDirty = Boolean(dirtyAt) || (version === undefined && hasLocalData());

      let toWrite: SyncedData | undefined;
      let updatedAt: string | undefined;
      if (!remote) {
        if (hasLocalData()) {
          toWrite = local;
          updatedAt = dirtyAt ?? new Date().toISOString();
        }
      } else if (remoteRow.version !== version) {
        // Le serveur a changé depuis notre dernière synchro.
        if (!localDirty) applyLocal(remote.data);
        else {
          const merged = mergeData(local, remote.data, (dirtyAt ?? '') > remote.updatedAt);
          applyLocal(merged);
          toWrite = merged;
          updatedAt = new Date().toISOString();
        }
      } else if (localDirty) {
        toWrite = local;
        updatedAt = dirtyAt ?? new Date().toISOString();
      }

      let newVersion = remoteRow.version;
      if (toWrite && updatedAt) {
        try {
          newVersion = (await api<{ version: number }>('/data', { method: 'PUT', body: { payload: payloadOf(toWrite, updatedAt), baseVersion: remoteRow.version } })).version;
        } catch (e) {
          if (e instanceof ApiError && e.status === 409 && e.body) {
            remoteRow = { version: Number(e.body.version) || 0, payload: typeof e.body.payload === 'string' ? e.body.payload : undefined };
            continue;
          }
          throw e;
        }
      }
      // Une modification faite pendant la synchro reste à envoyer.
      const stillDirty = useAuth.getState().dirtyAt !== dirtyAt;
      useAuth.setState({ version: newVersion, dirtyAt: stillDirty ? useAuth.getState().dirtyAt : undefined, status: 'ok', lastSyncAt: new Date().toISOString() });
      if (stillDirty) scheduleSync(1500);
      break;
    }
    // Partage avec les amis : une erreur ici ne doit pas bloquer la sauvegarde.
    const { user } = useAuth.getState();
    if (user) {
      try {
        const friendsChanged = await publishShare(useStore.getState(), user);
        usePublish.setState({ error: undefined });
        if (friendsChanged) void refreshFriends(useStore.getState().friends, 0);
      } catch (e) {
        usePublish.setState({ error: (e as Error).message });
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return signedOut();
    useAuth.setState({ status: 'error', error: (e as Error).message });
  }
}

/** Lance une synchronisation (les appels concurrents sont regroupés). */
export function syncNow(): Promise<void> {
  if (running) {
    pending = true;
    return running;
  }
  running = syncOnce().finally(() => {
    running = undefined;
    if (pending) {
      pending = false;
      void syncNow();
    }
  });
  return running;
}

export function scheduleSync(delay = 4000) {
  if (!isSignedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Recharge le compte connecté (après une connexion, ou au démarrage pour vérifier la session). */
export async function refreshSession(): Promise<boolean> {
  try {
    const me = await fetchMe();
    const changed = useAuth.getState().user?.login !== me.user.login;
    // Autre compte que celui de la dernière fois sur cet appareil : on repart de zéro pour la version serveur.
    useAuth.setState({ user: me.user, passkeys: me.passkeys, githubConfigured: me.githubConfigured, ...(changed ? { version: undefined } : {}), error: undefined });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      if (useAuth.getState().user) signedOut();
      else useAuth.setState({ user: undefined, passkeys: undefined });
      return false;
    }
    // Hors-ligne : on garde l'utilisateur connu, la synchro réessaiera.
    return Boolean(useAuth.getState().user);
  }
}

/** Après une connexion réussie : charge le compte, synchronise et récupère un éventuel import de l'ancien gist. */
export async function afterSignIn() {
  if (!(await refreshSession())) throw new Error('Connexion impossible.');
  await syncNow();
  if (useAuth.getState().status === 'error') throw new Error(useAuth.getState().error);
}

/** Fusionne les données importées de l'ancien gist GitHub (préparées par le serveur), puis les envoie. */
export async function applyGistImport(): Promise<boolean> {
  let row: { payload: string };
  try {
    row = await api<{ payload: string }>('/import');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return false;
    throw e;
  }
  const imported = parsePayload(row.payload);
  if (imported) {
    const local = pickSynced(useStore.getState());
    // Les données locales sont « plus récentes » : en cas de doublon, ce qui est sur l'appareil l'emporte.
    applyLocal(hasLocalData() ? mergeData(local, imported.data, true) : imported.data);
    useAuth.setState({ dirtyAt: new Date().toISOString() });
    await syncNow();
  }
  await api('/import', { method: 'DELETE' });
  return Boolean(imported);
}

/** Déconnexion : les données restent sur le serveur ; on peut aussi les effacer de cet appareil. */
export async function logout(clearLocal: boolean) {
  clearTimeout(timer);
  // On envoie d'abord ce qui n'est pas encore sauvegardé.
  if (useAuth.getState().dirtyAt) await syncNow().catch(() => undefined);
  await api('/logout', { method: 'POST' }).catch(() => undefined);
  useAuth.setState({ user: undefined, passkeys: undefined, version: undefined, dirtyAt: undefined, status: 'idle', error: undefined, lastSyncAt: undefined });
  usePublish.setState({ lastContent: undefined, error: undefined, publishedAt: undefined });
  if (clearLocal) {
    useStore.getState().reset();
    useFriends.setState({ data: {} });
  }
}

/** Suppression définitive du compte et de toutes ses données sur le serveur. */
export async function deleteAccount() {
  await api('/account', { method: 'DELETE' });
  useAuth.setState({ user: undefined, passkeys: undefined, version: undefined, dirtyAt: undefined, status: 'idle', error: undefined, lastSyncAt: undefined });
  usePublish.setState({ lastContent: undefined, error: undefined, publishedAt: undefined });
  useFriends.setState({ data: {} });
}

let started = false;

/** Écoute les modifications locales et resynchronise au retour sur l'app. */
export function startSync() {
  if (started) return;
  started = true;
  useStore.subscribe((state, prev) => {
    if (applying) return;
    if (!SYNCED_KEYS.some((k) => state[k] !== prev[k])) return;
    if (!isSignedIn()) return;
    useAuth.setState({ dirtyAt: new Date().toISOString() });
    scheduleSync();
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', () => void syncNow());
  void refreshSession().then((ok) => (ok ? syncNow() : undefined));
}
