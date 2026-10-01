import { getExercise } from '../data/exercises';
import type { LoggedExercise, PlannedExercise, Workout } from './types';

export interface Suggestion {
  weight: number;
  reps: number;
  reason: string;
}

/** Dernières performances d'un exercice, de la plus récente à la plus ancienne. */
export function history(workouts: Workout[], exerciseId: string, excludeId?: string): { date: string; ex: LoggedExercise }[] {
  return workouts
    .filter((w) => w.finished && w.id !== excludeId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((w) => w.exercises.filter((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done)).map((ex) => ({ date: w.date, ex })));
}

const roundTo = (n: number, step: number) => (step > 0 ? Math.round(n / step) * step : n);

/**
 * Surcharge progressive :
 * - Fourchette fixe (ex. 5×5) : progression linéaire, +incrément si tout est réussi, -10 % après 3 échecs.
 * - Fourchette de reps (ex. 8–12) : double progression, on ajoute des reps puis de la charge
 *   quand toutes les séries atteignent le haut de la fourchette.
 */
export function suggest(target: PlannedExercise, past: { ex: LoggedExercise }[]): Suggestion | undefined {
  const last = past[0]?.ex;
  if (!last) return undefined;
  const done = last.sets.filter((s) => s.done);
  if (done.length === 0) return undefined;
  const inc = getExercise(target.exerciseId).increment;
  const topWeight = Math.max(...done.map((s) => s.weight));
  const working = done.filter((s) => s.weight === topWeight);
  const minReps = Math.min(...working.map((s) => s.reps));
  const allSets = working.length >= target.sets;

  if (inc === 0) {
    // Poids du corps : on progresse en répétitions.
    return { weight: topWeight, reps: Math.min(minReps + 1, target.repMax + 5), reason: 'Poids du corps : vise +1 rep par série.' };
  }

  if (target.repMin === target.repMax) {
    const hit = allSets && minReps >= target.repMax;
    if (hit) return { weight: topWeight + inc, reps: target.repMax, reason: `Séance réussie : +${inc} kg.` };
    const fails = past.slice(0, 3).filter(({ ex }) => {
      const d = ex.sets.filter((s) => s.done);
      const w = Math.max(...d.map((s) => s.weight));
      return d.filter((s) => s.weight === w).some((s) => s.reps < target.repMax) && w === topWeight;
    }).length;
    if (fails >= 3) return { weight: roundTo(topWeight * 0.9, inc), reps: target.repMax, reason: '3 échecs à cette charge : décharge de 10 %.' };
    return { weight: topWeight, reps: target.repMax, reason: 'Même charge, valide toutes les séries.' };
  }

  if (allSets && minReps >= target.repMax) {
    return { weight: topWeight + inc, reps: target.repMin, reason: `Haut de fourchette atteint : +${inc} kg et repars à ${target.repMin} reps.` };
  }
  return {
    weight: topWeight,
    reps: Math.min(Math.max(minReps + 1, target.repMin), target.repMax),
    reason: `Garde la charge, vise ${Math.min(Math.max(minReps + 1, target.repMin), target.repMax)} reps sur chaque série.`,
  };
}
