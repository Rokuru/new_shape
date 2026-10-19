import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bestE1rm, tonnage, weeklyVolume } from './calc';
import { prefillSets, suggest, warmupFor, withWarmup } from './progression';
import { sanitizeWorkout } from './sanitize';
import { useStore } from './store';
import type { LoggedExercise, PlannedExercise, Program, Workout } from './types';
import { weeklyReport } from './weeklyReport';

const target: PlannedExercise = { exerciseId: 'leg_press', sets: 2, repMin: 10, repMax: 12, restSec: 90, rir: 2 };
const lastTime: LoggedExercise = {
  exerciseId: 'leg_press',
  target,
  sets: [
    { weight: 80, reps: 12, done: true, warmup: true },
    { weight: 160, reps: 12, done: true },
    { weight: 160, reps: 12, done: true },
  ],
};
const workout = (date: string, ex: LoggedExercise): Workout => ({ id: date, date: `${date}T18:00:00.000Z`, dayName: 'A', finished: true, durationMin: 50, exercises: [ex] });

describe('séries d’échauffement', () => {
  it('proposée à ~50 % de la charge de travail, arrondie à l’incrément, 6 à 12 répétitions', () => {
    // Presse : incrément de 5 kg → 165 × 50 % = 82,5 arrondi à 85.
    expect(warmupFor('leg_press', [{ weight: 165, reps: 12, done: false }], [])).toEqual({ weight: 85, reps: 12, done: false, warmup: true });
    expect(warmupFor('leg_press', [{ weight: 100, reps: 15, done: false }], [])!.reps).toBe(12);
    expect(warmupFor('leg_press', [{ weight: 100, reps: 4, done: false }], [])!.reps).toBe(6);
    // Pas d'échauffement pour le gainage ni les exercices au poids du corps.
    expect(warmupFor('plank', [{ weight: 0, reps: 30, done: false }], [])).toBeUndefined();
    expect(warmupFor('pullup', [{ weight: 0, reps: 8, done: false }], [])).toBeUndefined();
    // Celle de la dernière fois est reprise telle quelle.
    expect(warmupFor('leg_press', [{ weight: 170, reps: 10, done: false }], [{ ex: lastTime }])).toEqual({ weight: 80, reps: 12, done: false, warmup: true });
  });

  it('la 1re série est l’échauffement ; les séries de travail suivent la progression sans en tenir compte', () => {
    const past = [{ ex: lastTime }];
    expect(suggest(target, past)).toMatchObject({ weight: 165, reps: 10 }); // 2 × 12 au haut de la fourchette : +5 kg (incrément de la presse)
    const work = prefillSets(past, target);
    expect(work).toEqual([
      { weight: 165, reps: 10, done: false },
      { weight: 165, reps: 10, done: false },
    ]);
    expect(withWarmup('leg_press', work, past).map((s) => [s.weight, s.reps, !!s.warmup])).toEqual([
      [80, 12, true],
      [165, 10, false],
      [165, 10, false],
    ]);
  });

  it('hors records, tonnage et volume', () => {
    const w = workout('2026-10-14', lastTime);
    expect(bestE1rm(w, 'leg_press')).toBeCloseTo(160 * (1 + 12 / 30), 1);
    expect(tonnage(w)).toBe(160 * 12 * 2);
    const vol = weeklyVolume([w], new Date('2026-10-15T12:00:00'));
    expect(Math.max(...Object.values(vol))).toBe(2); // 2 séries de travail, l'échauffement ne compte pas
  });

  it('gardée au rechargement et à la synchro (et seulement si vraie)', () => {
    const w = sanitizeWorkout({ ...workout('2026-10-14', lastTime), exercises: [{ ...lastTime, sets: [...lastTime.sets, { weight: 50, reps: 10, done: true, warmup: 'oui' }] }] })!;
    expect(w.exercises[0].sets.map((s) => s.warmup === true)).toEqual([true, false, false, false]);
  });

  it('bilan pour Claude : échauffement listé à part, hors décompte des séries', () => {
    const r = weeklyReport(
      { profile: useStore.getState().profile, body: [], workouts: [workout('2026-10-14', lastTime)], cardio: [], food: [], kcalAdjust: 0 },
      '2026-10-12',
      '2026-10-18',
    ).replace(/[  ]/g, ' ');
    expect(r).toContain('- Presse à cuisses (Leg press) : échauffement 80×12 ; 160×12, 160×12 — prévu 2×10–12 @2');
    expect(r).toMatch(/1 séance sur \d+ prévues · [^·]+ · 2 séries · tonnage 3,8 t/);
    expect(r).toContain('« échauffement » = séries d’échauffement');
  });
});

describe('séance démarrée : échauffement en tête de chaque exercice chargé', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T18:00:00'));
    useStore.getState().reset();
    useStore.setState({ workouts: [workout('2026-10-14', lastTime)] });
  });
  afterEach(() => vi.useRealTimers());

  it('programme : échauffement puis séries de travail pré-remplies', () => {
    const program: Program = {
      id: 'p',
      name: 'P',
      author: '',
      description: '',
      level: ['beginner'],
      goals: ['cut'],
      daysPerWeek: 2,
      progression: '',
      days: [{ name: 'A', exercises: [target, { exerciseId: 'plank', sets: 2, repMin: 20, repMax: 30, restSec: 45, rir: 2 }] }],
    };
    useStore.getState().startWorkout(program, 0);
    const [press, plank] = useStore.getState().activeWorkout!.exercises;
    expect(press.sets.map((s) => [s.weight, !!s.warmup])).toEqual([
      [80, true],
      [165, false],
      [165, false],
    ]);
    expect(press.target?.sets).toBe(2);
    expect(plank.sets.some((s) => s.warmup)).toBe(false);
  });
});
