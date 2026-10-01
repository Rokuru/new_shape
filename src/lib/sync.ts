import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createGist, fetchUser, findGist, GitHubError, readGist, updateGist, type GitHubUser } from './github';
import { pickSynced, SYNCED_KEYS, useStore, type SyncedData } from './store';

/** Contenu du gist : les données + la date de la dernière modification. */
export interface SyncPayload {
  app: 'new-shape';
  version: 1;
  updatedAt: string;
  data: SyncedData;
}

type Status = 'idle' | 'syncing' | 'ok' | 'error';

interface AuthState {
  token?: string;
  user?: GitHubUser;
  gistId?: string;
  /** updatedAt de la version distante déjà intégrée localement. */
  syncedAt?: string;
  /** Date de la dernière modification locale non encore envoyée. */
  dirtyAt?: string;
  status: Status;
  error?: string;
  lastSyncAt?: string;
}

export const useAuth = create<AuthState>()(
  persist((): AuthState => ({ status: 'idle' }), {
    name: 'new-shape-auth',
    partialize: ({ token, user, gistId, syncedAt, dirtyAt, lastSyncAt }) => ({ token, user, gistId, syncedAt, dirtyAt, lastSyncAt }),
  }),
);

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

async function syncOnce() {
  const { token } = useAuth.getState();
  if (!token) return;
  useAuth.setState({ status: 'syncing', error: undefined });
  try {
    let { gistId } = useAuth.getState();
    if (!gistId) gistId = await findGist(token);
    const remote = gistId ? parsePayload(await readGist(token, gistId)) : undefined;
    const { syncedAt, dirtyAt } = useAuth.getState();
    const local = pickSynced(useStore.getState());
    // Premier lien d'un appareil qui a déjà des données : elles sont à fusionner.
    const localDirty = Boolean(dirtyAt) || (!syncedAt && hasLocalData());

    let toWrite: SyncedData | undefined;
    let updatedAt = remote?.updatedAt;

    if (!remote) {
      if (hasLocalData()) {
        toWrite = local;
        updatedAt = dirtyAt ?? new Date().toISOString();
      }
    } else if (remote.updatedAt !== syncedAt) {
      // Le distant a changé depuis notre dernière synchro.
      if (!localDirty) applyLocal(remote.data);
      else {
        const localIsNewer = (dirtyAt ?? '') > remote.updatedAt;
        const merged = mergeData(local, remote.data, localIsNewer);
        applyLocal(merged);
        toWrite = merged;
        updatedAt = new Date().toISOString();
      }
    } else if (localDirty) {
      toWrite = local;
      updatedAt = dirtyAt ?? new Date().toISOString();
    }

    if (toWrite && updatedAt) {
      const content = payloadOf(toWrite, updatedAt);
      if (gistId) await updateGist(token, gistId, content);
      else gistId = await createGist(token, content);
    }
    // Une modification faite pendant la synchro reste à envoyer.
    const stillDirty = useAuth.getState().dirtyAt !== dirtyAt;
    useAuth.setState({
      gistId,
      syncedAt: updatedAt,
      dirtyAt: stillDirty ? useAuth.getState().dirtyAt : undefined,
      status: 'ok',
      lastSyncAt: new Date().toISOString(),
    });
    if (stillDirty) scheduleSync(1500);
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 0;
    useAuth.setState({ status: 'error', error: status === 0 ? 'Hors connexion : synchronisation reportée.' : (e as Error).message });
    if (status === 401) useAuth.setState({ token: undefined });
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
  if (!useAuth.getState().token) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export async function login(token: string) {
  const user = await fetchUser(token.trim());
  useAuth.setState({ token: token.trim(), user, gistId: undefined, syncedAt: undefined, status: 'idle', error: undefined });
  await syncNow();
  if (useAuth.getState().status === 'error') throw new Error(useAuth.getState().error);
}

/** Déconnexion : les données restent dans le gist ; on peut aussi les effacer de cet appareil. */
export function logout(clearLocal: boolean) {
  clearTimeout(timer);
  useAuth.setState({ token: undefined, user: undefined, gistId: undefined, syncedAt: undefined, dirtyAt: undefined, status: 'idle', error: undefined, lastSyncAt: undefined });
  if (clearLocal) useStore.getState().reset();
}

let started = false;

/** Écoute les modifications locales et resynchronise au retour sur l'app. */
export function startSync() {
  if (started) return;
  started = true;
  useStore.subscribe((state, prev) => {
    if (applying) return;
    if (!SYNCED_KEYS.some((k) => state[k] !== prev[k])) return;
    if (!useAuth.getState().token) return;
    useAuth.setState({ dirtyAt: new Date().toISOString() });
    scheduleSync();
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', () => void syncNow());
  if (useAuth.getState().token) void syncNow();
}
