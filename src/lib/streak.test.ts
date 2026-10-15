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

describe('flamme bleue : série maintenue par les calories', () => {
  // Objectif 2 420 kcal (avec le déficit), maintenance 3 000 kcal (sans le déficit), minimum 1 500 kcal.
  const days = activityByDay({
    workouts: [w('2026-10-05T18:00:00')],
    cardio: [],
    food: [
      { id: 'a', date: '2026-10-05', at: '', kcal: 3600 }, // séance + surplus
      { id: 'b', date: '2026-10-06', at: '', kcal: 2800 }, // au-dessus de l'objectif, sous la maintenance
      { id: 'c', date: '2026-10-07', at: '', kcal: 2300 }, // dans la cible
      { id: 'd', date: '2026-10-08', at: '', kcal: 3300 }, // au-dessus de la maintenance
      { id: 'e', date: '2026-10-09', at: '', kcal: 1200 }, // sous le minimum
      { id: 'f', date: '2026-10-10', at: '', kcal: 3000 }, // pile la maintenance
    ],
    sex: 'male',
    kcalTarget: 2420,
    kcalMaintenance: 3000,
  });

  it('bleue sans séance ni marche si les calories restent entre le minimum et la maintenance', () => {
    expect(days.get('2026-10-06')).toMatchObject({ level: 0, kcalOk: false, kcalKept: true, blue: true });
    expect(days.get('2026-10-10')).toMatchObject({ level: 0, blue: true });
    // Dans la cible : la flamme orange habituelle, pas de bleue.
    expect(days.get('2026-10-07')).toMatchObject({ level: 1, kcalOk: true, blue: false });
    // Au-dessus de la maintenance ou sous le minimum : pas de flamme.
    expect(days.get('2026-10-08')).toMatchObject({ level: 0, kcalKept: false, blue: false });
    expect(days.get('2026-10-09')).toMatchObject({ level: 0, kcalKept: false, blue: false });
    // Une séance garde sa flamme orange, même en surplus.
    expect(days.get('2026-10-05')).toMatchObject({ sport: true, level: 1, kcalKept: false, blue: false });
  });

  it('la série continue avec une flamme bleue et s’arrête au-dessus de la maintenance ou sous le minimum', () => {
    expect(currentStreak(days, '2026-10-07')).toBe(3); // 5 (séance), 6 (bleue), 7 (cible)
    expect(currentStreak(days, '2026-10-08')).toBe(3); // la journée en cours ne casse pas encore la série
    expect(currentStreak(days, '2026-10-09')).toBe(0); // le 8, au-dessus de la maintenance, l'a cassée
    expect(currentStreak(days, '2026-10-10')).toBe(1); // le 9, sous le minimum, aussi ; le 10 repart en bleu
  });

  it('sans maintenance connue : pas de flamme bleue', () => {
    const d = activityByDay({ workouts: [], cardio: [], food: [{ id: 'f', date: '2026-10-06', at: '', kcal: 2800 }], sex: 'male', kcalTarget: 2420 });
    expect(d.get('2026-10-06')).toMatchObject({ level: 0, blue: false });
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
