import { addDays, dayKey, localDate, parseLocalDate } from './dates';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bodyFatOf, bodyweightAt, bestE1rm, startOfWeek, tonnage, weightTrend } from './calc';
import { createGist, deleteGist, fetchPublicShare, fetchPublicUser, findGist, isValidLogin, SHARE_FILE, updateGist, type GitHubUser } from './github';
import type { useStore } from './store';
import type { Goal, Level, Sex } from './types';
import { day, isoDate, num, str } from './sanitize';

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
  /** Ancien format : pseudos des amis en clair (lu, plus publié). */
  friends: string[];
  /** Amis sous forme d'empreintes (SHA-256 de « moi:ami ») : permet de détecter un ami mutuel sans publier la liste. */
  friendHashes?: string[];
}

/** Empreinte d'un lien d'amitié, salée par le pseudo du propriétaire du partage. */
export async function friendHash(owner: string, friend: string): Promise<string> {
  const data = new TextEncoder().encode(`new-shape:${owner.toLowerCase()}:${friend.toLowerCase()}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    // Jour seulement (pas l'heure) : le partage est public, inutile de dévoiler ses horaires d'entraînement.
    stats: { workouts: workouts.length, since: workouts[0] ? dayKey(workouts[0].date) : undefined, lastWorkout: workouts.at(-1) ? dayKey(workouts.at(-1)!.date) : undefined },
    lifts,
    weekly,
    body,
    recent,
    // La liste d'amis n'est plus publiée en clair : voir friendHashes (ajouté à la publication).
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
 * L'identité affichée ne vient jamais du fichier mais de l'API GitHub (voir lookupFriend).
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
    // Remplacé par l'identité vérifiée auprès de GitHub dans lookupFriend.
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
    friends: list(p.friends, 500).filter((f): f is string => typeof f === 'string' && LOGIN.test(f)),
    friendHashes: list(p.friendHashes, 500).filter((h): h is string => typeof h === 'string' && /^[0-9a-f]{24}$/.test(h)),
  };
}

// ---------- Publication de mon partage ----------

interface PublishState {
  gistId?: string;
  /** Format du partage publié par cet appareil (voir SHARE_FORMAT). */
  format?: number;
  error?: string;
  publishedAt?: string;
  /** Contenu publié (hors date), pour ne pas republier à l'identique. */
  lastContent?: string;
}
export const usePublish = create<PublishState>()(persist((): PublishState => ({}), { name: 'new-shape-share' }));

const withoutDate = (p: SharePayload) => JSON.stringify({ ...p, updatedAt: '' });

/**
 * Version 2 : jours sans heure, liste d'amis en empreintes. Un gist public garde l'historique de ses révisions :
 * pour que les anciennes versions (amis en clair, heures) disparaissent, le gist est recréé une fois.
 */
const SHARE_FORMAT = 2;

export async function publishShare(token: string, state: AppState, user: GitHubUser): Promise<void> {
  let { gistId } = usePublish.getState();
  const upgrade = usePublish.getState().format !== SHARE_FORMAT;
  if (!state.share.enabled) {
    if (!gistId) gistId = await findGist(token, SHARE_FILE);
    if (gistId) await deleteGist(token, gistId);
    usePublish.setState({ gistId: undefined, lastContent: undefined });
    return;
  }
  const payload = { ...buildShare(state, user), friendHashes: await Promise.all(state.friends.map((f) => friendHash(user.login, f))) };
  const key = withoutDate(payload);
  if (gistId && !upgrade && key === usePublish.getState().lastContent) return;
  const content = JSON.stringify(payload);
  if (!gistId) gistId = await findGist(token, SHARE_FILE);
  if (gistId && upgrade) {
    await deleteGist(token, gistId);
    gistId = undefined;
  }
  if (gistId) await updateGist(token, gistId, content, SHARE_FILE);
  else gistId = await createGist(token, content, { file: SHARE_FILE, isPublic: true, description: 'New Shape – progrès partagés avec mes amis' });
  usePublish.setState({ gistId, lastContent: key, publishedAt: payload.updatedAt, format: SHARE_FORMAT });
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
const AVATAR = /^https:\/\/avatars\.githubusercontent\.com\//;
/** Cache local des amis : revalidé au chargement (il a pu être écrit par une version moins stricte). */
function cleanEntry(e: unknown): FriendEntry | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const x = e as Record<string, unknown>;
  const u = x.user as Record<string, unknown> | undefined;
  const user =
    u && typeof u.login === 'string' && LOGIN.test(u.login)
      ? { login: u.login, name: typeof u.name === 'string' ? u.name.slice(0, 100) : null, avatarUrl: typeof u.avatarUrl === 'string' && AVATAR.test(u.avatarUrl) ? u.avatarUrl : '' }
      : undefined;
  const parsed = x.share ? parseShare(JSON.stringify(x.share)) : undefined;
  const status = ['ok', 'not_found', 'not_shared', 'error'].includes(x.status as string) ? (x.status as FriendEntry['status']) : 'error';
  return { user, share: parsed && user ? { ...parsed, user } : undefined, status, fetchedAt: typeof x.fetchedAt === 'string' ? x.fetchedAt : new Date(0).toISOString() };
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

export async function lookupFriend(token: string, login: string): Promise<FriendEntry> {
  const key = login.toLowerCase();
  let entry: FriendEntry;
  if (!isValidLogin(login)) entry = { status: 'not_found', fetchedAt: new Date().toISOString() };
  else {
    try {
      const user = await fetchPublicUser(token, login);
      if (!user) entry = { status: 'not_found', fetchedAt: new Date().toISOString() };
      else {
        const parsed = parseShare(await fetchPublicShare(token, user.login));
        // L'identité affichée est celle vérifiée par GitHub, jamais celle écrite dans le fichier du tiers.
        const share = parsed ? { ...parsed, user } : undefined;
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
