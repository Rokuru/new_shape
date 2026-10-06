/**
 * Validation des données venues de l'extérieur : fichier importé, gist synchronisé, stockage local.
 * Un fichier mal formé (ou piégé) ne doit ni faire planter l'app, ni injecter de lien dangereux :
 * on garde ce qui est valide, on borne les nombres et on écarte le reste, sans jamais lever d'erreur.
 */
import type { BiaData, BodyEntry, CardioEntry, FoodEntry, Goal, Level, LoggedExercise, LoggedSet, PlannedExercise, Program, ProgramDay, ProgramStyle, Segment, Workout } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Nombre fini dans [min, max], sinon undefined. */
export function num(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
}
const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
};
/** Chaîne non vide, tronquée à `max` caractères. */
export function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;
}
const id = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : undefined);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Jour AAAA-MM-JJ valide (entre 1900 et 2100). */
export function day(v: unknown): string | undefined {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return undefined;
  const t = Date.parse(`${v}T12:00:00Z`);
  return Number.isFinite(t) && v >= '1900-01-01' && v <= '2100-12-31' ? v : undefined;
}
/** Date ISO (avec heure) valide. */
export function isoDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 40) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) && t > Date.UTC(1900, 0, 1) && t < Date.UTC(2101, 0, 1) ? v : undefined;
}
/** Lien externe : https uniquement (pas de javascript:, data:, etc.). */
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 2000) return undefined;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | undefined => (values.includes(v as T) ? (v as T) : undefined);
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Garde le premier élément de chaque identifiant (doublons écartés). */
function uniqueById<T extends { id: string }>(items: (T | undefined)[]): T[] {
  const seen = new Set<string>();
  return items.filter((x): x is T => !!x && !seen.has(x.id) && !!seen.add(x.id));
}

const SEGMENTS: Segment[] = ['armR', 'armL', 'legR', 'legL', 'trunk'];
const GOALS: Goal[] = ['cut', 'recomp', 'bulk', 'strength'];
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const STYLES: ProgramStyle[] = ['force', 'powerbuilding', 'hypertrophie', 'haute_intensite', 'poids_du_corps', 'court'];

function segs(v: unknown, min: number, max: number): Partial<Record<Segment, number>> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<Record<Segment, number>> = {};
  for (const s of SEGMENTS) {
    const n = num(v[s], min, max);
    if (n !== undefined) out[s] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function bia(v: unknown): BiaData | undefined {
  if (!isObj(v)) return undefined;
  const out: BiaData = {};
  const set = (k: keyof Omit<BiaData, 'segFat' | 'segMuscle'>, min: number, max: number) => {
    const n = num(v[k], min, max);
    if (n !== undefined) out[k] = n;
  };
  set('waterPct', 10, 90);
  set('muscleKg', 5, 200);
  set('physique', 1, 9);
  set('boneKg', 0.3, 15);
  set('kcal', 300, 10000);
  set('metabolicAge', 5, 120);
  set('visceral', 1, 59);
  const f = segs(v.segFat, 1, 80);
  const m = segs(v.segMuscle, 0.1, 100);
  if (f) out.segFat = f;
  if (m) out.segMuscle = m;
  return out;
}

export function sanitizeBody(v: unknown): BodyEntry | undefined {
  if (!isObj(v)) return undefined;
  const entryId = id(v.id);
  const date = day(v.date);
  const weightKg = num(v.weightKg, 20, 400);
  if (!entryId || !date || weightKg === undefined) return undefined;
  const e: BodyEntry = { id: entryId, date, weightKg };
  const bf = num(v.bodyFatPct, 1, 80);
  if (bf !== undefined) e.bodyFatPct = bf;
  for (const k of ['waistCm', 'neckCm', 'hipCm', 'chestCm', 'armCm', 'thighCm'] as const) {
    const n = num(v[k], 5, 300);
    if (n !== undefined) e[k] = n;
  }
  const note = str(v.note, 2000);
  if (note) e.note = note;
  if (v.bia !== undefined) {
    const b = bia(v.bia);
    if (b) e.bia = b;
  }
  return e;
}

function planned(v: unknown): PlannedExercise | undefined {
  if (!isObj(v)) return undefined;
  const exerciseId = str(v.exerciseId, 60);
  if (!exerciseId) return undefined;
  const repMin = Math.round(clampNum(v.repMin, 1, 100, 8));
  return {
    exerciseId,
    sets: Math.round(clampNum(v.sets, 1, 20, 3)),
    repMin,
    repMax: Math.max(repMin, Math.round(clampNum(v.repMax, 1, 100, repMin))),
    rir: Math.round(clampNum(v.rir, 0, 10, 2)),
    restSec: Math.round(clampNum(v.restSec, 0, 900, 120)),
    ...(str(v.note, 300) ? { note: str(v.note, 300) } : {}),
  };
}

function loggedSet(v: unknown): LoggedSet | undefined {
  if (!isObj(v)) return undefined;
  const s: LoggedSet = { weight: Math.round(clampNum(v.weight, 0, 1000, 0) * 100) / 100, reps: Math.round(clampNum(v.reps, 0, 1000, 0)), done: v.done === true };
  const rir = num(v.rir, 0, 10);
  if (rir !== undefined) s.rir = Math.round(rir);
  return s;
}

function loggedExercise(v: unknown): LoggedExercise | undefined {
  if (!isObj(v)) return undefined;
  const exerciseId = str(v.exerciseId, 60);
  if (!exerciseId) return undefined;
  const e: LoggedExercise = { exerciseId, sets: arr(v.sets).slice(0, 50).map(loggedSet).filter((x): x is LoggedSet => !!x) };
  const t = v.target === undefined ? undefined : planned(v.target);
  if (t) e.target = t;
  return e;
}

export function sanitizeWorkout(v: unknown): Workout | undefined {
  if (!isObj(v)) return undefined;
  const wid = id(v.id);
  const date = isoDate(v.date);
  if (!wid || !date) return undefined;
  const w: Workout = {
    id: wid,
    date,
    dayName: str(v.dayName, 100) ?? 'Séance',
    exercises: arr(v.exercises).slice(0, 60).map(loggedExercise).filter((x): x is LoggedExercise => !!x),
    finished: v.finished !== false,
  };
  const pid = str(v.programId, 64);
  if (pid) w.programId = pid;
  const dur = num(v.durationMin, 0, 1440);
  if (dur !== undefined) w.durationMin = Math.round(dur);
  const note = str(v.note, 2000);
  if (note) w.note = note;
  if (Array.isArray(v.stretches)) {
    w.stretches = v.stretches
      .slice(0, 30)
      .filter(isObj)
      .map((s) => ({ id: str(s.id, 60) ?? '', done: s.done === true }))
      .filter((s) => s.id);
  }
  return w;
}

export function sanitizeCardio(v: unknown): CardioEntry | undefined {
  if (!isObj(v)) return undefined;
  const cid = id(v.id);
  const date = day(v.date);
  if (!cid || !date) return undefined;
  const c: CardioEntry = { id: cid, date, inclinePct: clampNum(v.inclinePct, 0, 40, 0) };
  const speed = num(v.speedKmh, 0.1, 30);
  const dur = num(v.durationMin, 1, 1440);
  const steps = num(v.steps, 1, 200000);
  if (speed !== undefined) c.speedKmh = speed;
  if (dur !== undefined) c.durationMin = dur;
  if (steps !== undefined) c.steps = Math.round(steps);
  return c.speedKmh || c.durationMin || c.steps ? c : undefined;
}

export function sanitizeFood(v: unknown): FoodEntry | undefined {
  if (!isObj(v)) return undefined;
  const fid = id(v.id);
  const date = day(v.date);
  if (!fid || !date) return undefined;
  const kcal = Math.round(clampNum(v.kcal, 0, 10000, 0));
  const prot = num(v.proteinG, 0, 1000);
  if (!kcal && !prot) return undefined;
  const f: FoodEntry = { id: fid, date, at: isoDate(v.at) ?? `${date}T12:00:00.000Z`, kcal };
  if (prot) f.proteinG = Math.round(prot * 10) / 10;
  const label = str(v.label, 100);
  if (label) f.label = label;
  return f;
}

function programDay(v: unknown): ProgramDay | undefined {
  if (!isObj(v)) return undefined;
  const d: ProgramDay = { name: str(v.name, 100) ?? 'Séance', exercises: arr(v.exercises).slice(0, 40).map(planned).filter((x): x is PlannedExercise => !!x) };
  if (Array.isArray(v.stretches)) d.stretches = v.stretches.filter((s): s is string => typeof s === 'string' && s.length <= 60).slice(0, 30);
  return d;
}

export function sanitizeProgram(v: unknown): Program | undefined {
  if (!isObj(v)) return undefined;
  const pid = id(v.id);
  const name = str(v.name, 100);
  const days = arr(v.days).slice(0, 14).map(programDay).filter((x): x is ProgramDay => !!x);
  if (!pid || !name || !days.length) return undefined;
  const level = arr(v.level).map((x) => oneOf(x, LEVELS)).filter((x): x is Level => !!x);
  const goals = arr(v.goals).map((x) => oneOf(x, GOALS)).filter((x): x is Goal => !!x);
  const p: Program = {
    id: pid,
    name,
    author: str(v.author, 100) ?? 'Moi',
    description: str(v.description, 2000) ?? '',
    level: level.length ? level : ['beginner'],
    goals: goals.length ? goals : ['recomp'],
    daysPerWeek: days.length,
    progression: str(v.progression, 2000) ?? '',
    days,
    custom: true,
  };
  if (typeof v.generated === 'boolean') p.generated = v.generated;
  const style = oneOf(v.style, STYLES);
  if (style) p.style = style;
  const dur = num(v.durationMin, 5, 300);
  if (dur !== undefined) p.durationMin = dur;
  const evidence = str(v.evidence, 4000);
  if (evidence) p.evidence = evidence;
  // Liens : https uniquement, pour qu'un fichier piégé ne puisse pas glisser un lien javascript:.
  const sources = arr(v.sources)
    .filter(isObj)
    .map((s) => ({ label: str(s.label, 200), url: safeUrl(s.url) }))
    .filter((s): s is { label: string; url: string } => !!s.label && !!s.url)
    .slice(0, 20);
  if (sources.length) p.sources = sources;
  return p;
}

export const sanitizeLogins = (v: unknown): string[] => [...new Set(arr(v).filter((x): x is string => typeof x === 'string' && LOGIN_RE.test(x)))].slice(0, 500);

/** Toutes les collections d'un état importé / synchronisé / stocké, nettoyées. */
export function sanitizeCollections(d: Obj) {
  return {
    body: uniqueById(arr(d.body).map(sanitizeBody)).sort((a, b) => a.date.localeCompare(b.date)),
    workouts: uniqueById(arr(d.workouts).map(sanitizeWorkout)).sort((a, b) => a.date.localeCompare(b.date)),
    customPrograms: uniqueById(arr(d.customPrograms).map(sanitizeProgram)).slice(0, 100),
    cardio: uniqueById(arr(d.cardio).map(sanitizeCardio)).sort((a, b) => a.date.localeCompare(b.date)),
    food: uniqueById(arr(d.food).map(sanitizeFood)),
    friends: sanitizeLogins(d.friends),
    deleted: arr(d.deleted).filter((x): x is string => typeof x === 'string' && x.length <= 64).slice(-20000),
    share: isObj(d.share) ? { enabled: d.share.enabled === true, body: d.share.body === true } : { enabled: false, body: false },
    activeProgramId: str(d.activeProgramId, 64),
    nextDayIndex: Math.round(clampNum(d.nextDayIndex, 0, 100, 0)),
    kcalAdjust: Math.round(clampNum(d.kcalAdjust, -1500, 1500, 0)),
    kcalAdjustedAt: day(d.kcalAdjustedAt),
  };
}
