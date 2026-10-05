import { addDays, dayKey, localDate, parseLocalDate } from './dates';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bodyFatOf, bodyweightAt, bestE1rm, startOfWeek, tonnage, weightTrend } from './calc';
import { api, ApiError, type AppUser } from './api';
import type { useStore } from './store';
import type { Goal, Level, Sex } from './types';
import { day, isoDate, num, str } from './sanitize';

type AppState = ReturnType<typeof useStore.getState>;

/**
 * Résumé de mes progrès, enregistré sur le serveur et lisible uniquement par mes amis mutuels
 * (ceux que j'ai ajoutés et qui m'ont ajouté). Ne contient que ce qui sert à comparer.
 */
export interface SharePayload {
  app: 'new-shape-share';
  version: 1;
  updatedAt: string;
  user: AppUser;
  profile: { goal: Goal; level: Level; sex: Sex; daysPerWeek: number };
  stats: { workouts: number; since?: string; lastWorkout?: string };
  /** 1RM estimé (meilleure série de chaque séance) par exercice. */
  lifts: Record<string, { date: string; e1rm: number }[]>;
  weekly: { week: string; sessions: number; tonnage: number }[];
  /** Présent seulement si l'utilisateur a choisi de partager son corps. */
  body?: { date: string; weight: number; bf?: number; muscle?: number }[];
  recent: { date: string; dayName: string; durationMin?: number; tonnage: number; top: { id: string; weight: number; reps: number }[] }[];
  /** Toujours vide : la liste d'amis n'est jamais partagée (le serveur connaît les liens mutuels). */
  friends: string[];
}


export function buildShare(s: Pick<AppState, 'profile' | 'workouts' | 'body' | 'friends' | 'share'>, user: AppUser, now = new Date()): SharePayload {
  const workouts = s.workouts.filter((w) => w.finished).sort((a, b) => a.date.localeCompare(b.date));

  // Exercices les plus pratiqués (12 max), 60 derniers points chacun.
  const freq = new Map<string, number>();
  for (const w of workouts) for (const e of w.exercises) freq.set(e.exerciseId, (freq.get(e.exerciseId) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id);
  const lifts: SharePayload['lifts'] = {};
  for (const id of top) {
    lifts[id] = workouts
      .map((w) => ({ date: dayKey(w.date), e1rm: bestE1rm(w, id, bodyweightAt(s.body, w.date)) }))
      .filter((p) => p.e1rm > 0)
      .slice(-60);
  }

  // 26 dernières semaines.
  const weekly: SharePayload['weekly'] = [];
  const start = startOfWeek(now);
  for (let i = 25; i >= 0; i--) {
    const week = addDays(localDate(start), -i * 7);
    const end = addDays(week, 7);
    const ws = workouts.filter((w) => dayKey(w.date) >= week && dayKey(w.date) < end);
    weekly.push({ week, sessions: ws.length, tonnage: Math.round(ws.reduce((t, w) => t + tonnage(w), 0)) });
  }

  let body: SharePayload['body'];
  if (s.share.body) {
    // Une valeur par semaine (dernière pesée lissée) : suffisant pour comparer, moins intrusif.
    const trend = new Map(weightTrend(s.body).map((t) => [t.date, t.trend]));
    const byWeek = new Map<string, NonNullable<SharePayload['body']>[number]>();
    for (const e of [...s.body].sort((a, b) => a.date.localeCompare(b.date))) {
      const wk = localDate(startOfWeek(parseLocalDate(e.date)));
      const prev = byWeek.get(wk);
      // Garde le % de gras / muscle mesuré dans la semaine même si la dernière pesée n'en a pas.
      byWeek.set(wk, { date: e.date, weight: trend.get(e.date) ?? e.weightKg, bf: bodyFatOf(e, s.profile) ?? prev?.bf, muscle: e.bia?.muscleKg ?? prev?.muscle });
    }
    body = [...byWeek.values()].slice(-52);
  }

  const recent = [...workouts]
    .reverse()
    .slice(0, 10)
    .map((w) => ({
      date: dayKey(w.date),
      dayName: w.dayName,
      durationMin: w.durationMin,
      tonnage: Math.round(tonnage(w)),
      top: w.exercises.slice(0, 4).map((e) => {
        const best = e.sets.filter((x) => x.done).sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];
        return { id: e.exerciseId, weight: best?.weight ?? 0, reps: best?.reps ?? 0 };
      }),
    }));

  return {
    app: 'new-shape-share',
    version: 1,
    updatedAt: now.toISOString(),
    user,
    profile: { goal: s.profile.goal, level: s.profile.level, sex: s.profile.sex, daysPerWeek: s.profile.daysPerWeek },
    // Jour seulement (pas l'heure) : inutile de dévoiler ses horaires d'entraînement, même à des amis.
    stats: { workouts: workouts.length, since: workouts[0] ? dayKey(workouts[0].date) : undefined, lastWorkout: workouts.at(-1) ? dayKey(workouts.at(-1)!.date) : undefined },
    lifts,
    weekly,
    body,
    recent,
    friends: [],
  };
}

/** Taille maximale acceptée pour le partage d'un tiers (un vrai partage pèse quelques dizaines de Ko). */
export const MAX_SHARE_BYTES = 512 * 1024;
type O = Record<string, unknown>;
const isO = (v: unknown): v is O => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const GOALS: Goal[] = ['cut', 'recomp', 'bulk', 'strength'];
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const EX_ID = /^[a-z0-9_]{1,40}$/;
const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * Partage lu chez un tiers : données NON fiables (n'importe qui peut publier un fichier piégé).
 * Tout est revérifié champ par champ ; ce qui est invalide est écarté, rien ne doit pouvoir faire planter l'app.
 * L'identité affichée ne vient jamais du fichier mais du compte vérifié par le serveur (voir lookupFriend).
 */
export function parseShare(text: string | undefined): SharePayload | undefined {
  if (!text || text.length > MAX_SHARE_BYTES) return undefined;
  let p: unknown;
  try {
    p = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isO(p) || p.app !== 'new-shape-share') return undefined;
  const prof = isO(p.profile) ? p.profile : {};
  const stats = isO(p.stats) ? p.stats : {};
  const lifts: SharePayload['lifts'] = {};
  if (isO(p.lifts)) {
    for (const [k, v] of Object.entries(p.lifts).slice(0, 40)) {
      if (!EX_ID.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const pts = list(v, 120)
        .filter(isO)
        .map((x) => ({ date: day(x.date), e1rm: num(x.e1rm, 0.1, 1500) }))
        .filter((x): x is { date: string; e1rm: number } => !!x.date && x.e1rm !== undefined);
      if (pts.length) Object.defineProperty(lifts, k, { value: pts, enumerable: true, writable: true, configurable: true });
    }
  }
  const weekly = list(p.weekly, 60)
    .filter(isO)
    .map((w) => ({ week: day(w.week), sessions: Math.round(num(w.sessions, 0, 50) ?? 0), tonnage: Math.round(num(w.tonnage, 0, 10_000_000) ?? 0) }))
    .filter((w): w is { week: string; sessions: number; tonnage: number } => !!w.week);
  const body = Array.isArray(p.body)
    ? list(p.body, 120)
        .filter(isO)
        .map((b) => ({ date: day(b.date), weight: num(b.weight, 20, 400), bf: num(b.bf, 1, 80), muscle: num(b.muscle, 5, 200) }))
        .filter((b): b is { date: string; weight: number; bf: number | undefined; muscle: number | undefined } => !!b.date && b.weight !== undefined)
    : undefined;
  const recent: SharePayload['recent'] = list(p.recent, 20)
    .filter(isO)
    .flatMap((w) => {
      // Ancien format : date ISO avec l'heure ; on ne garde que le jour.
      const date = day(w.date) ?? (isoDate(w.date) ? day(String(w.date).slice(0, 10)) : undefined);
      if (!date) return [];
      return [
        {
          date,
          dayName: str(w.dayName, 80) ?? 'Séance',
          durationMin: num(w.durationMin, 0, 1440),
          tonnage: Math.round(num(w.tonnage, 0, 10_000_000) ?? 0),
          top: list(w.top, 8)
            .filter(isO)
            .map((t) => ({ id: typeof t.id === 'string' && EX_ID.test(t.id) ? t.id : '', weight: num(t.weight, 0, 1000) ?? 0, reps: Math.round(num(t.reps, 0, 1000) ?? 0) }))
            .filter((t) => t.id),
        },
      ];
    });
  return {
    app: 'new-shape-share',
    version: 1,
    updatedAt: isoDate(p.updatedAt) ?? '',
    // Remplacé par l'identité vérifiée par le serveur dans lookupFriend.
    user: { login: '', name: null, avatarUrl: '' },
    profile: {
      goal: GOALS.includes(prof.goal as Goal) ? (prof.goal as Goal) : 'recomp',
      level: LEVELS.includes(prof.level as Level) ? (prof.level as Level) : 'intermediate',
      sex: prof.sex === 'female' ? 'female' : 'male',
      daysPerWeek: Math.round(num(prof.daysPerWeek, 1, 7) ?? 3),
    },
    stats: { workouts: Math.round(num(stats.workouts, 0, 100_000) ?? 0), since: day(String(stats.since ?? '').slice(0, 10)), lastWorkout: day(String(stats.lastWorkout ?? '').slice(0, 10)) },
    lifts,
    weekly,
    body: body?.length ? body : undefined,
    recent,
    friends: [],
  };
}

// ---------- Publication de mon partage ----------

interface PublishState {
  error?: string;
  publishedAt?: string;
  /** Contenu envoyé (hors date), pour ne pas renvoyer à l'identique. */
  lastContent?: string;
}
export const usePublish = create<PublishState>()(persist((): PublishState => ({}), { name: 'new-shape-share-v2' }));

/**
 * Envoie au serveur mon partage (ou sa suppression s'il est désactivé) et la liste des amis que j'ai ajoutés.
 * Le serveur ne montre mon partage qu'aux amis de cette liste qui m'ont eux aussi ajouté.
 */
export async function publishShare(state: AppState, user: AppUser): Promise<boolean> {
  const friends = state.friends.map((f) => f.toLowerCase());
  const payload = state.share.enabled ? buildShare(state, user) : undefined;
  const key = JSON.stringify({ enabled: state.share.enabled, friends, payload: payload && { ...payload, updatedAt: '' } });
  const prev = usePublish.getState().lastContent;
  if (key === prev) return false;
  const res = await api<{ publishedAt?: string }>('/share', { method: 'PUT', body: { enabled: state.share.enabled, payload: payload && JSON.stringify(payload), friends } });
  usePublish.setState({ lastContent: key, publishedAt: res.publishedAt });
  // Liste d'amis modifiée : le statut « mutuel » a pu changer, on relit les amis sans attendre le cache.
  return !prev || JSON.stringify((JSON.parse(prev) as { friends?: string[] }).friends) !== JSON.stringify(friends);
}

// ---------- Lecture des amis ----------

export interface FriendEntry {
  user?: AppUser;
  share?: SharePayload;
  /** L'ami m'a lui aussi ajouté. */
  mutual?: boolean;
  fetchedAt: string;
  /** 'not_found' : pas de compte ; 'not_mutual' : ne m'a pas (encore) ajouté ; 'not_shared' : partage désactivé. */
  status: 'ok' | 'not_found' | 'not_mutual' | 'not_shared' | 'error';
}

interface FriendsState {
  data: Record<string, FriendEntry | undefined>;
}
/** Avatars acceptés : photo GitHub, photo envoyée (servie par l'app) ou avatar prédéfini de l'app. */
const AVATAR = /^(https:\/\/avatars\.githubusercontent\.com\/|\/api\/avatar\/[\w-]{1,64}\?v=[\w.:%-]{1,40}$|\/avatars\/a\d{2}\.svg$)/;
const STATUSES: FriendEntry['status'][] = ['ok', 'not_found', 'not_mutual', 'not_shared', 'error'];
function cleanUser(u: unknown): AppUser | undefined {
  if (!isO(u) || typeof u.login !== 'string' || !LOGIN.test(u.login)) return undefined;
  return { login: u.login, name: typeof u.name === 'string' ? u.name.slice(0, 100) : null, avatarUrl: typeof u.avatarUrl === 'string' && AVATAR.test(u.avatarUrl) ? u.avatarUrl : '', github: u.github === true };
}
/** Cache local des amis : revalidé au chargement. */
function cleanEntry(e: unknown): FriendEntry | undefined {
  if (!isO(e)) return undefined;
  const user = cleanUser(e.user);
  const parsed = e.share ? parseShare(JSON.stringify(e.share)) : undefined;
  const status = STATUSES.includes(e.status as FriendEntry['status']) ? (e.status as FriendEntry['status']) : 'error';
  return { user, share: parsed && user ? { ...parsed, user } : undefined, mutual: e.mutual === true, status, fetchedAt: typeof e.fetchedAt === 'string' ? e.fetchedAt : new Date(0).toISOString() };
}
export const useFriends = create<FriendsState>()(
  persist((): FriendsState => ({ data: {} }), {
    name: 'new-shape-friends',
    merge: (persisted, current) => {
      const raw = (persisted as Partial<FriendsState> | undefined)?.data;
      const data: FriendsState['data'] = {};
      if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (LOGIN.test(k)) data[k] = cleanEntry(v);
      return { ...current, data };
    },
  }),
);

export const isValidLogin = (login: string) => LOGIN.test(login);

export async function lookupFriend(login: string): Promise<FriendEntry> {
  const key = login.toLowerCase();
  let entry: FriendEntry;
  if (!isValidLogin(login)) entry = { status: 'not_found', fetchedAt: new Date().toISOString() };
  else {
    try {
      const r = await api<{ status?: string; user?: unknown; share?: string; mutual?: boolean }>(`/friends/${encodeURIComponent(login)}`);
      const user = cleanUser(r.user);
      const status = STATUSES.includes(r.status as FriendEntry['status']) ? (r.status as FriendEntry['status']) : 'error';
      const parsed = status === 'ok' ? parseShare(r.share) : undefined;
      // L'identité affichée est celle du compte vérifié par le serveur, jamais celle écrite dans le partage.
      const share = parsed && user ? { ...parsed, user } : undefined;
      entry = user ? { user, share, mutual: r.mutual === true, status: status === 'ok' && !share ? 'error' : status, fetchedAt: new Date().toISOString() } : { status: 'not_found', fetchedAt: new Date().toISOString() };
    } catch (e) {
      // Hors-ligne (ou session expirée) : on garde la dernière version connue.
      const prev = useFriends.getState().data[key];
      if (e instanceof ApiError && e.status === 401) throw e;
      return prev ? { ...prev, status: prev.share ? prev.status : 'error' } : { status: 'error', fetchedAt: new Date().toISOString() };
    }
  }
  useFriends.setState((s) => ({ data: { ...s.data, [key]: entry } }));
  return entry;
}

/** Recharge les amis dont les données ont plus de `maxAgeMin` minutes. */
export async function refreshFriends(logins: string[], maxAgeMin = 10) {
  const now = Date.now();
  await Promise.all(
    logins
      .filter((l) => {
        const e = useFriends.getState().data[l.toLowerCase()];
        return !e || now - new Date(e.fetchedAt).getTime() > maxAgeMin * 60_000;
      })
      .map((l) => lookupFriend(l).catch(() => undefined)),
  );
}

// ---------- Comparaison ----------

/** Fusionne deux séries datées sur un axe commun ; `indexed` exprime chaque série en % depuis son premier point. */
export function mergeSeries(
  mine: { date: string; value: number }[],
  theirs: { date: string; value: number }[],
  indexed: boolean,
): { date: string; me?: number; friend?: number }[] {
  const norm = (s: { date: string; value: number }[]) => {
    const base = s[0]?.value;
    return s.map((p) => ({ date: p.date, value: indexed && base ? Math.round(((p.value - base) / base) * 1000) / 10 : p.value }));
  };
  const map = new Map<string, { date: string; me?: number; friend?: number }>();
  for (const p of norm(mine)) map.set(p.date, { ...map.get(p.date), date: p.date, me: p.value });
  for (const p of norm(theirs)) map.set(p.date, { ...map.get(p.date), date: p.date, friend: p.value });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
