import { addDays, dayKey, localDate, parseLocalDate } from './dates';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bodyFatOf, bodyweightAt, bestE1rm, startOfWeek, tonnage, weightTrend } from './calc';
import { createGist, deleteGist, fetchPublicShare, fetchPublicUser, findGist, isValidLogin, SHARE_FILE, updateGist, type GitHubUser } from './github';
import type { useStore } from './store';
import type { Goal, Level, Sex } from './types';

type AppState = ReturnType<typeof useStore.getState>;

/**
 * Résumé public de mes progrès, publié dans un gist public de mon compte GitHub
 * pour que mes amis puissent le lire. Ne contient que ce qui sert à comparer.
 */
export interface SharePayload {
  app: 'new-shape-share';
  version: 1;
  updatedAt: string;
  user: GitHubUser;
  profile: { goal: Goal; level: Level; sex: Sex; daysPerWeek: number };
  stats: { workouts: number; since?: string; lastWorkout?: string };
  /** 1RM estimé (meilleure série de chaque séance) par exercice. */
  lifts: Record<string, { date: string; e1rm: number }[]>;
  weekly: { week: string; sessions: number; tonnage: number }[];
  /** Présent seulement si l'utilisateur a choisi de partager son corps. */
  body?: { date: string; weight: number; bf?: number; muscle?: number }[];
  recent: { date: string; dayName: string; durationMin?: number; tonnage: number; top: { id: string; weight: number; reps: number }[] }[];
  friends: string[];
}


export function buildShare(s: Pick<AppState, 'profile' | 'workouts' | 'body' | 'friends' | 'share'>, user: GitHubUser, now = new Date()): SharePayload {
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
      date: w.date,
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
    stats: { workouts: workouts.length, since: workouts[0]?.date, lastWorkout: workouts.at(-1)?.date },
    lifts,
    weekly,
    body,
    recent,
    friends: s.friends,
  };
}

/** Validation minimale d'un partage lu chez un tiers (données non fiables). */
export function parseShare(text: string | undefined): SharePayload | undefined {
  if (!text) return undefined;
  try {
    const p = JSON.parse(text) as SharePayload;
    if (p?.app !== 'new-shape-share' || typeof p.lifts !== 'object' || !Array.isArray(p.weekly) || !Array.isArray(p.recent)) return undefined;
    return { ...p, friends: Array.isArray(p.friends) ? p.friends.filter((f) => typeof f === 'string') : [] };
  } catch {
    return undefined;
  }
}

// ---------- Publication de mon partage ----------

interface PublishState {
  gistId?: string;
  error?: string;
  publishedAt?: string;
  /** Contenu publié (hors date), pour ne pas republier à l'identique. */
  lastContent?: string;
}
export const usePublish = create<PublishState>()(persist((): PublishState => ({}), { name: 'new-shape-share' }));

const withoutDate = (p: SharePayload) => JSON.stringify({ ...p, updatedAt: '' });

export async function publishShare(token: string, state: AppState, user: GitHubUser): Promise<void> {
  let { gistId } = usePublish.getState();
  if (!state.share.enabled) {
    if (!gistId) gistId = await findGist(token, SHARE_FILE);
    if (gistId) await deleteGist(token, gistId);
    usePublish.setState({ gistId: undefined, lastContent: undefined });
    return;
  }
  const payload = buildShare(state, user);
  const key = withoutDate(payload);
  if (gistId && key === usePublish.getState().lastContent) return;
  const content = JSON.stringify(payload);
  if (!gistId) gistId = await findGist(token, SHARE_FILE);
  if (gistId) await updateGist(token, gistId, content, SHARE_FILE);
  else gistId = await createGist(token, content, { file: SHARE_FILE, isPublic: true, description: 'New Shape – progrès partagés avec mes amis' });
  usePublish.setState({ gistId, lastContent: key, publishedAt: payload.updatedAt });
}

// ---------- Lecture des amis ----------

export interface FriendEntry {
  user?: GitHubUser;
  share?: SharePayload;
  fetchedAt: string;
  /** 'not_found' : pas de compte GitHub ; 'not_shared' : n'a pas activé le partage. */
  status: 'ok' | 'not_found' | 'not_shared' | 'error';
}

interface FriendsState {
  data: Record<string, FriendEntry | undefined>;
}
export const useFriends = create<FriendsState>()(persist((): FriendsState => ({ data: {} }), { name: 'new-shape-friends' }));

export async function lookupFriend(token: string, login: string): Promise<FriendEntry> {
  const key = login.toLowerCase();
  let entry: FriendEntry;
  if (!isValidLogin(login)) entry = { status: 'not_found', fetchedAt: new Date().toISOString() };
  else {
    try {
      const user = await fetchPublicUser(token, login);
      if (!user) entry = { status: 'not_found', fetchedAt: new Date().toISOString() };
      else {
        const share = parseShare(await fetchPublicShare(token, user.login));
        entry = { user, share, status: share ? 'ok' : 'not_shared', fetchedAt: new Date().toISOString() };
      }
    } catch {
      // Hors-ligne : on garde la dernière version connue.
      const prev = useFriends.getState().data[key];
      entry = prev ? { ...prev, status: prev.share ? prev.status : 'error' } : { status: 'error', fetchedAt: new Date().toISOString() };
      return entry;
    }
  }
  useFriends.setState((s) => ({ data: { ...s.data, [key]: entry } }));
  return entry;
}

/** Recharge les amis dont les données ont plus de `maxAgeMin` minutes. */
export async function refreshFriends(token: string, logins: string[], maxAgeMin = 10) {
  const now = Date.now();
  await Promise.all(
    logins
      .filter((l) => {
        const e = useFriends.getState().data[l.toLowerCase()];
        return !e || now - new Date(e.fetchedAt).getTime() > maxAgeMin * 60_000;
      })
      .map((l) => lookupFriend(token, l)),
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
