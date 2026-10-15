import { describe, expect, it } from 'vitest';
import { BASICFIT_CUT } from '../data/plans';
import { ACTIVITY_FACTORS, computeBmr } from './calc';
import { cardioStats } from './cardio';
import { addDays, daysBetween } from './dates';
import { deficitStart, deficitStartSource, deficitSummary, deficitTally, kcalGoal, KCAL_PER_KG } from './deficit';
import { workoutKcal } from './energy';
import { DEFAULT_PROFILE, sanitizeProfile } from './store';
import type { BodyEntry, CardioEntry, FoodEntry, Profile, Workout } from './types';

const profile: Profile = {
  ...DEFAULT_PROFILE,
  sex: 'male',
  heightCm: 178,
  birthYear: 1993,
  activity: 'light',
  targetWeightKg: 93,
  targetBodyFatPct: 20,
  targetStartKg: 118,
  targetStartBfPct: 33,
  targetSetAt: '2026-10-13',
  plan: { id: BASICFIT_CUT.id, start: '2026-10-14' },
};
const body: BodyEntry[] = [{ id: 'b1', date: '2026-10-13', weightKg: 118, bodyFatPct: 33 }];
const meal = (date: string, kcal: number, i = 0): FoodEntry => ({ id: `${date}-${i}`, date, at: `${date}T12:00:00`, kcal });
const food: FoodEntry[] = [
  meal('2026-10-12', 3000), // avant le départ : ignoré
  meal('2026-10-14', 1200),
  meal('2026-10-14', 1100, 1),
  meal('2026-10-15', 2000),
  meal('2026-10-16', 600), // journée incomplète
  meal('2026-10-18', 900), // aujourd'hui
];
const workout: Workout = {
  id: 'w1',
  date: new Date('2026-10-15T18:00:00').toISOString(),
  dayName: 'Séance A',
  finished: true,
  durationMin: 60,
  exercises: [{ exerciseId: 'leg_press', sets: [{ weight: 100, reps: 12, done: true }] }],
};
const walk: CardioEntry = { id: 'c1', date: '2026-10-14', speedKmh: 4, durationMin: 40, inclinePct: 5 };
const data = { profile, body, food, workouts: [workout], cardio: [walk] };

describe('calories à perdre', () => {
  it('objectif = gras à perdre × 7 700 kcal : 118 kg à 33 % → 93 kg à 20 %', () => {
    const g = kcalGoal(profile, body)!;
    expect(g.basis).toBe('fat');
    expect(g.startFatKg).toBeCloseTo(38.94, 2);
    expect(g.targetFatKg).toBeCloseTo(18.6, 2);
    expect(g.toLoseKg).toBeCloseTo(20.34, 2);
    expect(g.kcal).toBeCloseTo(20.34 * KCAL_PER_KG, 0); // ≈ 156 600 kcal
  });

  it('sans % de gras : poids à perdre ; rien pour un objectif de prise', () => {
    const noBf = { ...profile, targetBodyFatPct: undefined, targetStartBfPct: undefined };
    expect(kcalGoal(noBf, body)).toMatchObject({ basis: 'weight', toLoseKg: 25, kcal: 25 * KCAL_PER_KG });
    // % de départ non enregistré : celui mesuré au départ.
    expect(kcalGoal({ ...profile, targetStartBfPct: undefined }, body)!.toLoseKg).toBeCloseTo(20.34, 2);
    expect(kcalGoal({ ...profile, targetWeightKg: 130, targetBodyFatPct: undefined }, body)).toBeUndefined();
    expect(kcalGoal({ ...profile, targetWeightKg: undefined }, body)).toBeUndefined();
  });

  it('départ du compteur : celui du plan, sinon le jour où l’objectif a été fixé', () => {
    expect(deficitStart(profile)).toBe('2026-10-14');
    expect(deficitStart({ ...profile, plan: undefined })).toBe('2026-10-13');
  });
});

describe('déficit compté', () => {
  it('maintenance du jour (métabolisme × activité + sport du jour) − repas notés, jusqu’à hier', () => {
    const t = deficitTally(data, '2026-10-14', '2026-10-18');
    const bmr = computeBmr(profile, 118, 33).bmr;
    const base = bmr * ACTIVITY_FACTORS.light;
    const walkKcal = cardioStats(walk, profile, 118).kcal;
    const liftKcal = workoutKcal(workout, bmr);
    expect(walkKcal).toBeGreaterThan(0);
    expect(liftKcal).toBeGreaterThan(0);
    expect(t.days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-15']);
    expect(t.days[0]).toMatchObject({ eaten: 2300, sport: walkKcal });
    expect(t.days[0].deficit).toBeCloseTo(base + walkKcal - 2300, 6);
    expect(t.days[1].deficit).toBeCloseTo(base + liftKcal - 2000, 6);
    expect(t.total).toBeCloseTo(t.days[0].deficit + t.days[1].deficit, 6);
    // 16 oct. : 600 kcal notées, moins de la moitié du métabolisme de base → repas oubliés, ignorée.
    expect(t.partial).toEqual(['2026-10-16']);
    expect(t.missing).toBe(1); // 17 oct. : rien de noté
    expect(t.eatenToday).toBe(900); // compté demain
  });

  it('résumé : avancement, moyenne, rythme du plan et date estimée', () => {
    const s = deficitSummary(data, '2026-10-18')!;
    const t = deficitTally(data, '2026-10-14', '2026-10-18');
    expect(s.pct).toBeCloseTo((t.total / s.goal.kcal) * 100, 6);
    expect(s.fatKg).toBeCloseTo(t.total / KCAL_PER_KG, 6);
    expect(s.avgPerDay).toBeCloseTo(t.total / 2, 6);
    // Reste à perdre ÷ jours restants jusqu'à la fin du plan (mardi 8 juin 2027, aujourd'hui compris).
    expect(s.planEnd).toBe('2027-06-08');
    expect(s.neededPerDay).toBeCloseTo((s.goal.kcal - t.total) / (daysBetween('2026-10-18', '2027-06-08') + 1), 6);
    expect(s.eta).toBe(addDays('2026-10-18', Math.ceil((s.goal.kcal - t.total) / s.avgPerDay!)));
    expect(s).toMatchObject({ reached: false, notStarted: false });
  });

  it('avant le départ du plan : compteur à zéro, rythme sur toute la durée du plan', () => {
    const s = deficitSummary(data, '2026-10-13')!;
    expect(s).toMatchObject({ notStarted: true, pct: 0, reached: false });
    expect(s.neededPerDay).toBeCloseTo(s.goal.kcal / (34 * 7), 6); // ≈ 658 kcal/jour
    expect(s.tally.days).toEqual([]);
    expect(s.eta).toBeUndefined();
  });

  it('surplus : total négatif, barre à zéro, pas de date estimée', () => {
    const s = deficitSummary({ ...data, food: [meal('2026-10-14', 6000)], workouts: [], cardio: [] }, '2026-10-15')!;
    expect(s.tally.total).toBeLessThan(0);
    expect(s.pct).toBe(0);
    expect(s.eta).toBeUndefined();
  });
});

describe('départ du compteur choisi', () => {
  const custom: Profile = { ...profile, deficitStart: '2026-10-01' };
  const withOct1: BodyEntry[] = [{ id: 'b0', date: '2026-09-30', weightKg: 119.4, bodyFatPct: 33.5 }, ...body];

  it('prioritaire sur le départ du plan et la date de l’objectif', () => {
    expect(deficitStart(custom)).toBe('2026-10-01');
    expect(deficitStartSource(custom)).toBe('custom');
    expect(deficitStartSource(profile)).toBe('plan');
    expect(deficitStartSource({ ...profile, plan: undefined })).toBe('goal');
  });

  it('objectif recalculé avec le poids et le % de gras de ce jour-là', () => {
    const g = kcalGoal(custom, withOct1)!;
    expect(g.startKg).toBeCloseTo(119.4, 6);
    expect(g.startBf).toBe(33.5);
    expect(g.toLoseKg).toBeCloseTo(119.4 * 0.335 - 18.6, 6);
    // Sans date choisie : le poids et le % enregistrés quand l'objectif a été fixé.
    expect(kcalGoal(profile, withOct1)!.startKg).toBe(118);
  });

  it('compte les repas à partir de cette date, sans toucher au plan', () => {
    const s = deficitSummary({ ...data, profile: custom, body: withOct1, food: [...food, meal('2026-10-05', 2200)] }, '2026-10-18')!;
    expect(s).toMatchObject({ source: 'custom', notStarted: false });
    expect(s.tally.from).toBe('2026-10-01');
    // Le 12 (avant le départ du plan) compte désormais ; le 16 reste une journée incomplète.
    expect(s.tally.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-12', '2026-10-14', '2026-10-15']);
    expect(s.planEnd).toBe('2027-06-08'); // fin du plan inchangée
  });

  it('gardé par la validation du profil (synchro, import)', () => {
    expect(sanitizeProfile(custom).deficitStart).toBe('2026-10-01');
    expect(sanitizeProfile({ ...custom, deficitStart: '1er octobre' }).deficitStart).toBeUndefined();
  });
});
