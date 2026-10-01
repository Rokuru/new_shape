import { describe, expect, it } from 'vitest';
import { adaptiveAdjustment, composition, e1rm, navyBodyFat, nutritionTargets, volumeFromSets, weeklyRate, weightTrend } from './calc';
import { generateProgram } from './generator';
import { suggest } from './progression';
import { DEFAULT_PROFILE } from './store';
import type { BodyEntry, LoggedExercise, PlannedExercise, Profile } from './types';
import { getExercise } from '../data/exercises';
import { PROGRAMS } from '../data/programs';

const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', heightCm: 180, birthYear: 1990 };

describe('composition corporelle', () => {
  it('estime le % de gras par la méthode US Navy', () => {
    // Homme 180 cm, taille 85 cm, cou 38 cm → ≈ 16 %
    expect(navyBodyFat('male', 180, 85, 38)).toBeCloseTo(16.1, 1);
    // Femme 165 cm, taille 72, cou 32, hanches 98 → ≈ 27 %
    expect(navyBodyFat('female', 165, 72, 32, 98)).toBeCloseTo(27.4, 1);
    expect(navyBodyFat('female', 165, 72, 32)).toBeUndefined();
  });

  it('calcule masses grasse / maigre et FFMI', () => {
    const c = composition({ id: '1', date: '2026-01-01', weightKg: 80, bodyFatPct: 15 }, profile);
    expect(c.fatKg).toBe(12);
    expect(c.leanKg).toBe(68);
    expect(c.ffmi).toBeCloseTo(21, 0);
  });
});

describe('tendance de poids', () => {
  const entries: BodyEntry[] = Array.from({ length: 21 }, (_, i) => ({
    id: String(i),
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    weightKg: 80 - i * 0.1 + (i % 2 ? 0.4 : -0.4),
  }));

  it('mesure le rythme hebdomadaire malgré le bruit', () => {
    const rate = weeklyRate(entries, 30, new Date('2026-01-22'));
    expect(rate).toBeCloseTo(-0.7, 1);
  });

  it('lisse les variations quotidiennes', () => {
    const t = weightTrend(entries);
    const swings = t.slice(1).map((p, i) => Math.abs(p.trend - t[i].trend));
    expect(Math.max(...swings)).toBeLessThan(0.4);
  });
});

describe('nutrition', () => {
  it('crée un déficit en sèche et des protéines élevées', () => {
    const latest = { id: '1', date: '2026-01-01', weightKg: 80 };
    const cut = nutritionTargets({ ...profile, goal: 'cut' }, latest);
    expect(cut.calories).toBeLessThan(cut.tdee);
    expect(cut.proteinG).toBe(176);
    expect(cut.proteinG * 4 + cut.fatG * 9 + cut.carbsG * 4).toBeCloseTo(cut.calories, -1);
    const bulk = nutritionTargets({ ...profile, goal: 'bulk' }, latest);
    expect(bulk.calories).toBeGreaterThan(bulk.tdee);
  });

  it('propose un ajustement quand la tendance dévie', () => {
    expect(adaptiveAdjustment(-0.1, -0.6)).toBe(-300);
    expect(adaptiveAdjustment(-0.55, -0.6)).toBe(0);
    expect(adaptiveAdjustment(-1.2, -0.6)).toBe(300);
    expect(adaptiveAdjustment(undefined, -0.6)).toBe(0);
  });
});

describe('performance', () => {
  it('estime le 1RM (Epley)', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.7, 1);
  });

  it('compte 1 série par muscle principal et ½ par secondaire', () => {
    const v = volumeFromSets([{ exerciseId: 'bench', sets: 4 }]);
    expect(v.chest).toBe(4);
    expect(v.triceps).toBe(2);
  });
});

describe('surcharge progressive', () => {
  const sets = (w: number, reps: number[]): LoggedExercise => ({ exerciseId: 'bench', sets: reps.map((r) => ({ weight: w, reps: r, done: true })) });
  const dbl: PlannedExercise = { exerciseId: 'bench', sets: 3, repMin: 8, repMax: 12, rir: 1, restSec: 120 };
  const lin: PlannedExercise = { exerciseId: 'bench', sets: 5, repMin: 5, repMax: 5, rir: 1, restSec: 180 };

  it('double progression : ajoute des reps puis de la charge', () => {
    expect(suggest(dbl, [{ ex: sets(60, [10, 9, 9]) }])).toMatchObject({ weight: 60, reps: 10 });
    expect(suggest(dbl, [{ ex: sets(60, [12, 12, 12]) }])).toMatchObject({ weight: 62.5, reps: 8 });
  });

  it('progression linéaire et décharge après 3 échecs', () => {
    expect(suggest(lin, [{ ex: sets(80, [5, 5, 5, 5, 5]) }])).toMatchObject({ weight: 82.5 });
    const fail = { ex: sets(80, [5, 5, 4, 4, 3]) };
    expect(suggest(lin, [fail])).toMatchObject({ weight: 80 });
    expect(suggest(lin, [fail, fail, fail])).toMatchObject({ weight: 72.5 });
  });
});

describe('générateur de programme', () => {
  it.each([2, 3, 4, 5, 6])('génère %i séances respectant le matériel et la durée', (days) => {
    for (const equipment of ['full_gym', 'home_dumbbells', 'bodyweight'] as const) {
      const p = generateProgram({ ...profile, daysPerWeek: days, equipment, sessionMinutes: 60 });
      expect(p.days).toHaveLength(days);
      for (const d of p.days) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(3);
        expect(d.exercises.reduce((s, e) => s + e.sets, 0)).toBeLessThanOrEqual(Math.floor(60 / 3.5));
        for (const e of d.exercises) expect(getExercise(e.exerciseId).equipment).toContain(equipment);
        expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(d.exercises.length);
      }
    }
  });

  it('donne plus de volume aux muscles prioritaires', () => {
    const base = generateProgram({ ...profile, daysPerWeek: 4, sessionMinutes: 90 });
    const prio = generateProgram({ ...profile, daysPerWeek: 4, sessionMinutes: 90, priorities: ['shoulders'] });
    const vol = (p: typeof base) => volumeFromSets(p.days.flatMap((d) => d.exercises)).shoulders;
    expect(vol(prio)).toBeGreaterThan(vol(base));
  });

  it('les programmes de la bibliothèque n’utilisent que des exercices connus', () => {
    for (const p of PROGRAMS) for (const d of p.days) for (const e of d.exercises) expect(getExercise(e.exerciseId).primary.length).toBeGreaterThan(0);
  });
});
