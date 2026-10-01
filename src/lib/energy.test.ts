import { describe, expect, it } from 'vitest';
import { activityAverage, workoutKcal, workoutMinutes } from './energy';
import { nutritionTargets } from './calc';
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
  it('une séance d’1 h à 82 kg ≈ 290 kcal nettes', () => {
    expect(workoutKcal(w('2026-10-01', 60), 82)).toBe(287);
    // Sans durée mesurée : ~3,5 min par série ; séance oubliée : plafonnée à 3 h.
    expect(workoutMinutes(w('2026-10-01', undefined, 20))).toBe(70);
    expect(workoutMinutes(w('2026-10-01', 600))).toBe(180);
  });

  it('utilise le plan du profil tant qu’il n’y a pas une semaine d’historique', () => {
    const a = activityAverage({ workouts: [], cardio: [], profile }, 80, new Date('2026-10-01T12:00:00Z'));
    expect(a.source).toBe('plan');
    expect(a.perDay).toBe(160); // 4 × 1 h × 3,5 × 80 / 7
  });

  it('fait la moyenne réelle sur 14 jours, marche comprise', () => {
    const workouts = ['2026-09-15', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30'].map((d) => w(d, 60));
    const cardio = [{ id: 'c', date: '2026-09-29', inclinePct: 10, speedKmh: 5, durationMin: 60 }];
    const a = activityAverage({ workouts, cardio, profile }, 80, new Date('2026-10-01T12:00:00Z'));
    expect(a.source).toBe('history');
    expect(a.days).toBe(14);
    expect(a.training).toBe(Math.round((5 * 280) / 14)); // la séance du 15 sort de la fenêtre (18/09 → 01/10)
    expect(a.walking).toBe(40); // 560 kcal / 14 j
  });

  it('augmente la maintenance sans toucher au calcul de l’objectif', () => {
    const latest = { id: 'b', date: '2026-10-01', weightKg: 80 };
    const base = nutritionTargets({ ...profile, goal: 'recomp' }, latest);
    const withSport = nutritionTargets({ ...profile, goal: 'recomp' }, latest, undefined, 0, 200);
    expect(withSport.tdee - base.tdee).toBe(200);
    expect(withSport.calories - base.calories).toBe(200);
  });
});
