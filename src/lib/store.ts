import { localDate } from './dates';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PROGRAMS } from '../data/programs';
import type { BodyEntry, CardioEntry, LoggedExercise, Profile, Program, ProgramDay, Workout } from './types';
import { history, suggest } from './progression';

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

/** Remplace toute valeur numérique absurde du profil (saisie, ancienne sauvegarde, synchro) par la valeur par défaut. */
export function sanitizeProfile(p: Partial<Profile> | undefined): Profile {
  const out: Profile = { ...DEFAULT_PROFILE, ...(p ?? {}) };
  const ok = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!ok(out.heightCm, PROFILE_LIMITS.heightCm.min, PROFILE_LIMITS.heightCm.max)) out.heightCm = DEFAULT_PROFILE.heightCm;
  if (!ok(out.birthYear, PROFILE_LIMITS.birthYear.min, PROFILE_LIMITS.birthYear.max)) out.birthYear = DEFAULT_PROFILE.birthYear;
  if (!ok(out.daysPerWeek, 2, 6)) out.daysPerWeek = DEFAULT_PROFILE.daysPerWeek;
  if (!ok(out.sessionMinutes, 10, 180)) out.sessionMinutes = DEFAULT_PROFILE.sessionMinutes;
  if (!Array.isArray(out.priorities)) out.priorities = [];
  if (out.targetWeightKg !== undefined && !ok(out.targetWeightKg, 30, 300)) delete out.targetWeightKg;
  if (out.targetStartKg !== undefined && !ok(out.targetStartKg, 25, 350)) delete out.targetStartKg;
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
  addCardio: (e: CardioEntry) => void;
  deleteCardio: (id: string) => void;
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
  return day.exercises.map((target) => {
    const s = suggest(target, history(workouts, target.exerciseId));
    return {
      exerciseId: target.exerciseId,
      target,
      sets: Array.from({ length: target.sets }, () => ({ weight: s?.weight ?? 0, reps: s?.reps ?? target.repMax, rir: undefined, done: false })),
    };
  });
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
      deleteCardio: (id) => set((s) => ({ cardio: s.cardio.filter((c) => c.id !== id), deleted: [...s.deleted, id] })),
      updateWorkout: (w) => set((s) => ({ workouts: s.workouts.map((x) => (x.id === w.id ? w : x)).sort((a, b) => a.date.localeCompare(b.date)) })),
      deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), deleted: [...s.deleted, id] })),
      setKcalAdjust: (n) => set({ kcalAdjust: n, kcalAdjustedAt: today() }),
      importData: (data) => {
        if (!data || typeof data !== 'object') throw new Error('Fichier invalide');
        const d = data as Partial<State>;
        if (!d.profile || !Array.isArray(d.body) || !Array.isArray(d.workouts)) throw new Error('Fichier invalide : profil, mesures ou séances manquants');
        set({
          ...initial,
          onboarded: true,
          profile: sanitizeProfile(d.profile),
          body: d.body,
          workouts: d.workouts,
          customPrograms: d.customPrograms ?? [],
          activeProgramId: d.activeProgramId,
          nextDayIndex: d.nextDayIndex ?? 0,
          kcalAdjust: d.kcalAdjust ?? 0,
          kcalAdjustedAt: d.kcalAdjustedAt,
          deleted: Array.isArray(d.deleted) ? d.deleted : [],
          friends: Array.isArray(d.friends) ? d.friends : [],
          cardio: Array.isArray(d.cardio) ? d.cardio : [],
          share: d.share ?? initial.share,
        });
      },
      addFriend: (login) => set((s) => (s.friends.some((f) => f.toLowerCase() === login.toLowerCase()) ? {} : { friends: [...s.friends, login] })),
      removeFriend: (login) => set((s) => ({ friends: s.friends.filter((f) => f.toLowerCase() !== login.toLowerCase()) })),
      setShare: (p) => set((s) => ({ share: { ...s.share, ...p } })),
      applySynced: (d) => set({ ...pickSynced(d), profile: sanitizeProfile(d.profile), friends: d.friends ?? [], cardio: d.cardio ?? [], share: d.share ?? initial.share, deleted: d.deleted ?? [] }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'new-shape-v1',
      version: 1,
      // Données déjà enregistrées avec un profil incohérent : corrigées au chargement.
      merge: (persisted, current) => {
        const s = { ...current, ...(persisted as Partial<State>) };
        return { ...s, profile: sanitizeProfile(s.profile) };
      },
    },
  ),
);

/** Données synchronisées entre appareils (tout sauf la séance en cours). */
export const SYNCED_KEYS = ['onboarded', 'profile', 'body', 'workouts', 'customPrograms', 'activeProgramId', 'nextDayIndex', 'kcalAdjust', 'kcalAdjustedAt', 'deleted', 'friends', 'share', 'cardio'] as const;
export type SyncedData = Pick<State, (typeof SYNCED_KEYS)[number]>;

export function pickSynced(s: SyncedData): SyncedData {
  return Object.fromEntries(SYNCED_KEYS.map((k) => [k, s[k]])) as SyncedData;
}

export function exportData(): string {
  return JSON.stringify({ app: 'new-shape', exportedAt: new Date().toISOString(), ...pickSynced(useStore.getState()) }, null, 2);
}
