import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PROGRAMS } from '../data/programs';
import type { BodyEntry, LoggedExercise, Profile, Program, ProgramDay, Workout } from './types';
import { history, suggest } from './progression';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const today = () => new Date().toISOString().slice(0, 10);

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
  setKcalAdjust: (n: number) => void;
  importData: (data: unknown) => void;
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
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      completeOnboarding: () => set({ onboarded: true }),
      upsertBody: (e) => set((s) => ({ body: [...s.body.filter((b) => b.id !== e.id && b.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date)) })),
      deleteBody: (id) => set((s) => ({ body: s.body.filter((b) => b.id !== id) })),
      saveCustomProgram: (p) => set((s) => ({ customPrograms: [p, ...s.customPrograms.filter((c) => c.id !== p.id)] })),
      deleteCustomProgram: (id) =>
        set((s) => ({ customPrograms: s.customPrograms.filter((c) => c.id !== id), activeProgramId: s.activeProgramId === id ? undefined : s.activeProgramId })),
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
      deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
      setKcalAdjust: (n) => set({ kcalAdjust: n }),
      importData: (data) => {
        if (!data || typeof data !== 'object') throw new Error('Fichier invalide');
        const d = data as Partial<State>;
        if (!d.profile || !Array.isArray(d.body) || !Array.isArray(d.workouts)) throw new Error('Fichier invalide : profil, mesures ou séances manquants');
        set({
          ...initial,
          onboarded: true,
          profile: { ...DEFAULT_PROFILE, ...d.profile },
          body: d.body,
          workouts: d.workouts,
          customPrograms: d.customPrograms ?? [],
          activeProgramId: d.activeProgramId,
          nextDayIndex: d.nextDayIndex ?? 0,
          kcalAdjust: d.kcalAdjust ?? 0,
        });
      },
      reset: () => set({ ...initial }),
    }),
    { name: 'new-shape-v1', version: 1 },
  ),
);

export function exportData(): string {
  const { onboarded, profile, body, workouts, customPrograms, activeProgramId, nextDayIndex, kcalAdjust } = useStore.getState();
  return JSON.stringify({ app: 'new-shape', exportedAt: new Date().toISOString(), onboarded, profile, body, workouts, customPrograms, activeProgramId, nextDayIndex, kcalAdjust }, null, 2);
}
