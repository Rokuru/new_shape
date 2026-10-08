import { describe, expect, it } from 'vitest';
import { activityAverage, dailyActivity, energyBasis, workoutKcal, workoutMinutes } from './energy';
import { computeBmr, nutritionTargets } from './calc';
import { DEFAULT_PROFILE } from './store';
import type { Workout } from './types';

const profile = { ...DEFAULT_PROFILE, daysPerWeek: 4, sessionMinutes: 60 };
const w = (date: string, durationMin?: number, sets = 18): Workout => ({
  id: date,
  date: `${date}T18:00:00Z`,
  dayName: 'Haut',
  finished: true,
  durationMin,
  exercises: [{ exerciseId: 'bench', sets: Array.from({ length: sets }, () => ({ weight: 60, reps: 8, done: true })) }],
});

describe('dépense liée au sport', () => {
  it('forte masse grasse : dépense de séance plus faible qu’avec la formule par kg', () => {
    const big = { ...profile, heightCm: 178, birthYear: 1993 };
    const bmr = computeBmr(big, 117.7, 33.2).bmr; // Mifflin-St Jeor (% de gras élevé)
    const kcal = workoutKcal(w('2026-10-01', 75), bmr);
    expect(kcal).toBeLessThan(Math.round((3.5 * 117.7 * 75) / 60)); // ancienne formule : 515 kcal
    expect(kcal).toBeGreaterThan(200);
    expect(kcal).toBeLessThan(320);
  });

  it('une séance d’1 h : (3,5 − 1) MET × métabolisme de base horaire', () => {
    // Métabolisme de base de 1 800 kcal/j : 75 kcal/h, soit 2,5 × 75 ≈ 188 kcal nettes.
    expect(workoutKcal(w('2026-10-01', 60), 1800)).toBe(188);
    // Sans durée mesurée : ~3,5 min par série ; séance oubliée : plafonnée à 3 h.
    expect(workoutMinutes(w('2026-10-01', undefined, 20))).toBe(70);
    expect(workoutMinutes(w('2026-10-01', 600))).toBe(180);
  });

  it('utilise le plan du profil tant qu’il n’y a pas une semaine d’historique', () => {
    const a = activityAverage({ workouts: [], cardio: [], profile }, 80, new Date('2026-10-01T12:00:00Z'));
    expect(a.source).toBe('plan');
    const bmr = computeBmr(profile, 80).bmr;
    expect(a.perDay).toBe(Math.round((4 * 2.5 * (bmr / 24)) / 7)); // 4 séances d'1 h / semaine
  });

  it('fait la moyenne réelle sur 14 jours, marche comprise', () => {
    const workouts = ['2026-09-15', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30'].map((d) => w(d, 60));
    const cardio = [{ id: 'c', date: '2026-09-29', inclinePct: 10, speedKmh: 5, durationMin: 60 }];
    const a = activityAverage({ workouts, cardio, profile }, 80, new Date('2026-10-01T12:00:00Z'));
    expect(a.source).toBe('history');
    expect(a.days).toBe(14);
    const perSession = Math.round(2.5 * (computeBmr(profile, 80).bmr / 24));
    expect(a.training).toBe(Math.round((5 * perSession) / 14)); // la séance du 15 sort de la fenêtre (18/09 → 01/10)
    expect(a.walking).toBe(40); // 560 kcal / 14 j
    // Détail affiché dans « Comment c'est calculé ».
    expect(a).toMatchObject({ windowDays: 14, sessions: 5, sessionMinutes: 300, walks: 1, walkMinutes: 60, walkingTotal: 560 });
    expect(a.trainingTotal).toBe(5 * perSession);
  });

  it('augmente la maintenance sans toucher au calcul de l’objectif', () => {
    const latest = { id: 'b', date: '2026-10-01', weightKg: 80 };
    const base = nutritionTargets({ ...profile, goal: 'recomp' }, latest);
    const withSport = nutritionTargets({ ...profile, goal: 'recomp' }, latest, undefined, 0, 200);
    expect(withSport.tdee - base.tdee).toBe(200);
    expect(withSport.calories - base.calories).toBe(200);
  });

  it('jour par jour : musculation et marche séparées, mêmes totaux que la moyenne de la cible', () => {
    const workouts = ['2026-09-15', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30'].map((d) => w(d, 60));
    const cardio = [{ id: 'c', date: '2026-09-29', inclinePct: 10, speedKmh: 5, durationMin: 60 }];
    const now = new Date('2026-10-01T12:00:00Z');
    const days = dailyActivity({ workouts, cardio, profile }, 80, 14, now);
    const a = activityAverage({ workouts, cardio, profile }, 80, now);
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe('2026-09-18');
    expect(days.at(-1)!.date).toBe('2026-10-01');
    expect(days.reduce((s, d) => s + d.training, 0)).toBe(a.trainingTotal);
    expect(days.reduce((s, d) => s + d.walking, 0)).toBe(a.walkingTotal);
    const sept29 = days.find((d) => d.date === '2026-09-29')!;
    expect(sept29).toMatchObject({ training: 0, walking: 560, sessions: 0, walkMinutes: 60 });
    const sept30 = days.find((d) => d.date === '2026-09-30')!;
    expect(sept30).toMatchObject({ sessions: 1, sessionMinutes: 60, walking: 0 });
    expect(sept30.training).toBe(workoutKcal(w('2026-09-30', 60), computeBmr(profile, 80).bmr));
  });

  it('poids des calories : celui de l’onglet Nutrition (tendance), 75 kg sans pesée', () => {
    expect(energyBasis([], profile)).toEqual({ weightKg: 75 });
    const b = energyBasis([{ id: '1', date: '2026-10-01', weightKg: 90, bodyFatPct: 25 }], profile);
    expect(b.weightKg).toBe(90);
    expect(b.bodyFatPct).toBe(25);
  });
});
