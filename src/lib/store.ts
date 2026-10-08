import { localDate } from './dates';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PROGRAMS } from '../data/programs';
import { getExercise, MUSCLES as MUSCLE_IDS } from '../data/exercises';
import { suggestStretches } from '../data/stretches';
import type { BodyEntry, CardioEntry, FoodEntry, LoggedExercise, Muscle, Profile, Program, ProgramDay, Workout } from './types';
import { history, prefillSets } from './progression';
import { sanitizeCollections, sanitizeWorkout } from './sanitize';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
/** Jour local (et non UTC) au format AAAA-MM-JJ. */
export const today = () => localDate();

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'male',
  birthYear: 1995,
  heightCm: 178,
  activity: 'light',
  goal: 'recomp',
  level: 'beginner',
  equipment: 'full_gym',
  daysPerWeek: 3,
  sessionMinutes: 60,
  priorities: [],
};

/** Bornes plausibles des champs numériques du profil (utilisées aussi par le formulaire). */
export const PROFILE_LIMITS = {
  heightCm: { min: 120, max: 230 },
  birthYear: { min: new Date().getFullYear() - 100, max: new Date().getFullYear() - 12 },
} as const;

/**
 * Profil fiable quelle que soit l'origine (saisie, ancienne sauvegarde, fichier importé, synchro) :
 * seuls les champs connus sont gardés, chaque valeur absurde ou d'un mauvais type reprend sa valeur par défaut.
 */
export function sanitizeProfile(p: Partial<Profile> | undefined): Profile {
  const src = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const ok = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const pick = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);
  const D = DEFAULT_PROFILE;
  const out: Profile = {
    name: typeof src.name === 'string' ? src.name.slice(0, 60) : D.name,
    sex: pick(src.sex, ['male', 'female'] as const, D.sex),
    birthYear: ok(src.birthYear, PROFILE_LIMITS.birthYear.min, PROFILE_LIMITS.birthYear.max) ? (src.birthYear as number) : D.birthYear,
    heightCm: ok(src.heightCm, PROFILE_LIMITS.heightCm.min, PROFILE_LIMITS.heightCm.max) ? (src.heightCm as number) : D.heightCm,
    activity: pick(src.activity, ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const, D.activity),
    goal: pick(src.goal, ['cut', 'recomp', 'bulk', 'strength'] as const, D.goal),
    level: pick(src.level, ['beginner', 'intermediate', 'advanced'] as const, D.level),
    equipment: pick(src.equipment, ['full_gym', 'home_dumbbells', 'bodyweight'] as const, D.equipment),
    daysPerWeek: ok(src.daysPerWeek, 2, 6) ? Math.round(src.daysPerWeek as number) : D.daysPerWeek,
    sessionMinutes: ok(src.sessionMinutes, 10, 180) ? (src.sessionMinutes as number) : D.sessionMinutes,
    priorities: Array.isArray(src.priorities) ? (src.priorities.filter((m) => MUSCLE_IDS.includes(m as Muscle)) as Muscle[]) : [],
  };
  const method = pick(src.bmrMethod, ['auto', 'mifflin', 'harris', 'katch', 'cunningham', 'tinsley'] as const, 'auto');
  if (src.bmrMethod !== undefined) out.bmrMethod = method;
  if (ok(src.targetWeightKg, 30, 300)) out.targetWeightKg = src.targetWeightKg as number;
  if (ok(src.targetStartKg, 25, 350)) out.targetStartKg = src.targetStartKg as number;
  if (typeof src.targetSetAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.targetSetAt)) out.targetSetAt = src.targetSetAt;
  if (ok(src.targetBodyFatPct, 3, 60)) out.targetBodyFatPct = src.targetBodyFatPct as number;
  if (ok(src.targetStartBfPct, 2, 70)) out.targetStartBfPct = src.targetStartBfPct as number;
  const split = pick(src.split, ['auto', 'full', 'upper_lower', 'ppl', 'mix', 'bro'] as const, 'auto');
  if (split !== 'auto') out.split = split;
  if (src.preferMachines === true) out.preferMachines = true;
  return out;
}

export interface ShareSettings {
  enabled: boolean;
  /** Inclure poids et composition corporelle. */
  body: boolean;
}

interface State {
  onboarded: boolean;
  profile: Profile;
  body: BodyEntry[];
  workouts: Workout[];
  customPrograms: Program[];
  activeProgramId?: string;
  nextDayIndex: number;
  activeWorkout?: Workout;
  /** Ajustement calorique manuel ou adaptatif (kcal/jour). */
  kcalAdjust: number;
  /** Date du dernier changement d'ajustement (YYYY-MM-DD). */
  kcalAdjustedAt?: string;
  /** Identifiants supprimés (mesures, séances, programmes), pour que la synchro ne les ressuscite pas. */
  deleted: string[];
  /** Pseudos GitHub suivis. */
  friends: string[];
  /** Marche sur tapis (pas + inclinaison). */
  cardio: CardioEntry[];
  food: FoodEntry[];
  /** Partage public de mes progrès (gist public), pour que mes amis me trouvent. */
  share: ShareSettings;

  setProfile: (p: Partial<Profile>) => void;
  completeOnboarding: () => void;
  upsertBody: (e: BodyEntry) => void;
  deleteBody: (id: string) => void;
  saveCustomProgram: (p: Program) => void;
  deleteCustomProgram: (id: string) => void;
  activateProgram: (id: string) => void;
  startWorkout: (program?: Program, dayIndex?: number) => void;
  updateActive: (fn: (w: Workout) => Workout) => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  deleteWorkout: (id: string) => void;
  updateWorkout: (w: Workout) => void;
  addWorkout: (w: Workout) => void;
  addCardio: (e: CardioEntry) => void;
  deleteCardio: (id: string) => void;
  addFood: (e: FoodEntry) => void;
  updateFood: (e: FoodEntry) => void;
  deleteFood: (id: string) => void;
  setKcalAdjust: (n: number) => void;
  importData: (data: unknown) => void;
  applySynced: (data: SyncedData) => void;
  addFriend: (login: string) => void;
  removeFriend: (login: string) => void;
  setShare: (s: Partial<ShareSettings>) => void;
  reset: () => void;
}

export const allPrograms = (custom: Program[]) => [...custom, ...PROGRAMS];

function buildExercises(day: ProgramDay, workouts: Workout[]): LoggedExercise[] {
  return day.exercises.map((target) => ({ exerciseId: target.exerciseId, target, sets: prefillSets(history(workouts, target.exerciseId), target) }));
}

const initial = {
  onboarded: false,
  profile: DEFAULT_PROFILE,
  body: [] as BodyEntry[],
  workouts: [] as Workout[],
  customPrograms: [] as Program[],
  activeProgramId: undefined as string | undefined,
  nextDayIndex: 0,
  activeWorkout: undefined as Workout | undefined,
  kcalAdjust: 0,
  kcalAdjustedAt: undefined as string | undefined,
  deleted: [] as string[],
  friends: [] as string[],
  cardio: [] as CardioEntry[],
  food: [] as FoodEntry[],
  share: { enabled: false, body: false } as ShareSettings,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      setProfile: (p) => set((s) => ({ profile: sanitizeProfile({ ...s.profile, ...p }) })),
      completeOnboarding: () => set({ onboarded: true }),
      upsertBody: (e) =>
        set((s) => {
          const replaced = s.body.filter((b) => b.id !== e.id && b.date === e.date).map((b) => b.id);
          return {
            body: [...s.body.filter((b) => b.id !== e.id && b.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date)),
            deleted: replaced.length ? [...s.deleted, ...replaced] : s.deleted,
          };
        }),
      deleteBody: (id) => set((s) => ({ body: s.body.filter((b) => b.id !== id), deleted: [...s.deleted, id] })),
      saveCustomProgram: (p) => set((s) => ({ customPrograms: [p, ...s.customPrograms.filter((c) => c.id !== p.id)] })),
      deleteCustomProgram: (id) =>
        set((s) => ({
          customPrograms: s.customPrograms.filter((c) => c.id !== id),
          activeProgramId: s.activeProgramId === id ? undefined : s.activeProgramId,
          deleted: [...s.deleted, id],
        })),
      activateProgram: (id) => set({ activeProgramId: id, nextDayIndex: 0 }),
      startWorkout: (program, dayIndex) => {
        const { workouts } = get();
        const day = program && dayIndex !== undefined ? program.days[dayIndex] : undefined;
        set({
          activeWorkout: {
            id: uid(),
            date: new Date().toISOString(),
            programId: program?.id,
            dayName: day?.name ?? 'Séance libre',
            exercises: day ? buildExercises(day, workouts) : [],
            stretches: day ? (day.stretches ?? suggestStretches(day.exercises, getExercise)).map((id) => ({ id, done: false })) : undefined,
            finished: false,
          },
        });
      },
      updateActive: (fn) => set((s) => (s.activeWorkout ? { activeWorkout: fn(s.activeWorkout) } : {})),
      finishWorkout: () => {
        const { activeWorkout, workouts, activeProgramId, nextDayIndex, customPrograms } = get();
        if (!activeWorkout) return;
        const durationMin = Math.round((Date.now() - new Date(activeWorkout.date).getTime()) / 60000);
        const finished: Workout = {
          ...activeWorkout,
          durationMin,
          finished: true,
          exercises: activeWorkout.exercises.filter((e) => e.sets.some((s) => s.done)),
        };
        const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);
        const advance = program && activeWorkout.programId === program.id;
        set({
          workouts: [...workouts, finished],
          activeWorkout: undefined,
          nextDayIndex: advance ? (nextDayIndex + 1) % program.days.length : nextDayIndex,
        });
      },
      cancelWorkout: () => set({ activeWorkout: undefined }),
      addCardio: (e) => set((s) => ({ cardio: [...s.cardio, e].sort((a, b) => a.date.localeCompare(b.date)) })),
      addFood: (e) => set((s) => ({ food: [...s.food, e] })),
      updateFood: (e) => set((s) => ({ food: s.food.map((f) => (f.id === e.id ? e : f)) })),
      deleteFood: (id) => set((s) => ({ food: s.food.filter((f) => f.id !== id), deleted: [...s.deleted, id] })),
      deleteCardio: (id) => set((s) => ({ cardio: s.cardio.filter((c) => c.id !== id), deleted: [...s.deleted, id] })),
      addWorkout: (w) => set((s) => ({ workouts: [...s.workouts, w].sort((a, b) => a.date.localeCompare(b.date)) })),
      updateWorkout: (w) => set((s) => ({ workouts: s.workouts.map((x) => (x.id === w.id ? w : x)).sort((a, b) => a.date.localeCompare(b.date)) })),
      deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), deleted: [...s.deleted, id] })),
      setKcalAdjust: (n) => set({ kcalAdjust: n, kcalAdjustedAt: today() }),
      importData: (data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Fichier invalide');
        const d = data as Record<string, unknown>;
        if (!d.profile || typeof d.profile !== 'object' || !Array.isArray(d.body) || !Array.isArray(d.workouts)) throw new Error('Fichier invalide : profil, mesures ou séances manquants');
        // Fichier venu d'ailleurs : chaque entrée est vérifiée, les invalides sont écartées (jamais de plantage).
        // Le partage public reste tel qu'il était : un fichier ne doit jamais pouvoir activer la publication de mes données.
        const share = get().share;
        set({ ...initial, onboarded: true, profile: sanitizeProfile(d.profile as Partial<Profile>), ...sanitizeCollections(d), share });
      },
      addFriend: (login) => set((s) => (s.friends.some((f) => f.toLowerCase() === login.toLowerCase()) ? {} : { friends: [...s.friends, login] })),
      removeFriend: (login) => set((s) => ({ friends: s.friends.filter((f) => f.toLowerCase() !== login.toLowerCase()) })),
      setShare: (p) => set((s) => ({ share: { ...s.share, ...p } })),
      applySynced: (d) => set({ onboarded: d.onboarded === true, profile: sanitizeProfile(d.profile), ...sanitizeCollections(d as unknown as Record<string, unknown>) }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'new-shape-v1',
      version: 1,
      // Données déjà enregistrées avec un profil incohérent : corrigées au chargement.
      // Données stockées par une ancienne version ou altérées : nettoyées au chargement, sans rien perdre de valide.
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
        return {
          ...current,
          onboarded: p.onboarded === true,
          profile: sanitizeProfile(p.profile as Partial<Profile> | undefined),
          ...sanitizeCollections(p),
          activeWorkout: p.activeWorkout ? sanitizeWorkout(p.activeWorkout) : undefined,
        };
      },
    },
  ),
);

/** Données synchronisées entre appareils (tout sauf la séance en cours). */
export const SYNCED_KEYS = ['onboarded', 'profile', 'body', 'workouts', 'customPrograms', 'activeProgramId', 'nextDayIndex', 'kcalAdjust', 'kcalAdjustedAt', 'deleted', 'friends', 'share', 'cardio', 'food'] as const;
export type SyncedData = Pick<State, (typeof SYNCED_KEYS)[number]>;

export function pickSynced(s: SyncedData): SyncedData {
  return Object.fromEntries(SYNCED_KEYS.map((k) => [k, s[k]])) as SyncedData;
}

export function exportData(): string {
  return JSON.stringify({ app: 'new-shape', exportedAt: new Date().toISOString(), ...pickSynced(useStore.getState()) }, null, 2);
}
