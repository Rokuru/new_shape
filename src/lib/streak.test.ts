import { describe, expect, it } from 'vitest';
import { activityByDay, currentStreak, monthGrid } from './streak';
import type { Workout } from './types';

const w = (date: string, finished = true) => ({ id: date, date, dayName: 'A', exercises: [], finished }) as Workout;

describe('flammes du calendrier', () => {
  const days = activityByDay({
    workouts: [w('2026-10-01T18:00:00'), w('2026-10-02T18:00:00'), w('2026-10-03T18:00:00', false)],
    cardio: [
      { id: 'c1', date: '2026-10-02', inclinePct: 5, durationMin: 30 },
      { id: 'c2', date: '2026-10-03', inclinePct: 0, durationMin: 0 },
    ],
    food: [
      { id: 'f1', date: '2026-10-02', at: '', kcal: 1000 },
      { id: 'f2', date: '2026-10-02', at: '', kcal: 900 },
      { id: 'f3', date: '2026-10-01', at: '', kcal: 1200 },
      { id: 'f4', date: '2026-09-30', at: '', kcal: 2500 },
    ],
    sex: 'male',
    kcalTarget: 2140,
  });

  it('séance = 1, marche = +1, calories dans la cible = +1', () => {
    expect(days.get('2026-10-02')).toMatchObject({ sport: true, extra: true, kcal: 1900, kcalOk: true, level: 3 });
  });

  it('pas de flamme pour les calories sous le minimum ou au-dessus de l’objectif', () => {
    expect(days.get('2026-10-01')).toMatchObject({ sport: true, kcalOk: false, level: 1 });
    expect(days.get('2026-09-30')).toMatchObject({ kcalOk: false, level: 0 });
  });

  it('séance non terminée ou marche vide : rien', () => {
    expect(days.get('2026-10-03')?.level ?? 0).toBe(0);
  });

  it('série : jours consécutifs, aujourd’hui ne la casse pas', () => {
    expect(currentStreak(days, '2026-10-02')).toBe(2);
    expect(currentStreak(days, '2026-10-03')).toBe(2);
    expect(currentStreak(days, '2026-10-04')).toBe(0);
  });

  it('sans objectif calorique connu, le critère calories est ignoré', () => {
    const d = activityByDay({ workouts: [], cardio: [], food: [{ id: 'f', date: '2026-10-02', at: '', kcal: 1800 }], sex: 'male' });
    expect(d.get('2026-10-02')?.level).toBe(0);
  });
});

describe('grille du mois', () => {
  it('commence le lundi et complète les semaines', () => {
    const g = monthGrid(2026, 9); // octobre 2026 : le 1er est un jeudi
    expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(g.length % 7).toBe(0);
    expect(g.filter(Boolean)).toHaveLength(31);
  });
});
