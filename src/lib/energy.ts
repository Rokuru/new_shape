import { addDays, dayKey, daysBetween, localDate } from './dates';
import { cardioStats, isValidCardio } from './cardio';
import { computeBmr } from './calc';
import type { CardioEntry, Profile, Workout } from './types';

/**
 * Intensité moyenne d'une séance de musculation, temps de repos compris : 3,5 MET
 * (Compendium of Physical Activities 2024, « plusieurs exercices, 8 à 15 répétitions »).
 */
export const RESISTANCE_MET = 3.5;

/** Durée d'une séance : celle mesurée, sinon ~3,5 min par série validée ; plafonnée à 3 h (séance non clôturée). */
export function workoutMinutes(w: Workout): number {
  const sets = w.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);
  return Math.min(180, w.durationMin && w.durationMin > 0 ? w.durationMin : sets * 3.5);
}

/**
 * Dépense nette d'une séance (au-delà du repos) : (MET − 1) × métabolisme de base horaire.
 * Le MET est rapporté au métabolisme de base de la personne et non au repos « standard » de 3,5 ml/kg/min
 * (MET corrigé, Kozey et al. 2010) : avec une forte masse grasse, la dépense de repos par kg est plus faible
 * et la formule par kg de poids surestimait nettement la dépense.
 */
export function workoutKcal(w: Workout, bmrKcal: number): number {
  return Math.round(((RESISTANCE_MET - 1) * (bmrKcal / 24) * workoutMinutes(w)) / 60);
}

export interface ActivityAverage {
  /** kcal/jour à ajouter à la dépense de base. */
  perDay: number;
  training: number;
  walking: number;
  /** 'history' : moyenne réelle ; 'plan' : estimée d'après le profil (pas encore assez d'historique). */
  source: 'history' | 'plan';
  /** Nombre de jours de la moyenne (de 1 à `windowDays`). */
  days: number;
  /** Fenêtre maximale de la moyenne (14 jours). */
  windowDays: number;
  /** Détail sur la période : nombre, durée totale (min) et calories totales. */
  sessions: number;
  sessionMinutes: number;
  trainingTotal: number;
  walks: number;
  walkMinutes: number;
  walkingTotal: number;
}

/**
 * Moyenne quotidienne de la dépense liée au sport (musculation + marche enregistrée) sur 14 jours.
 * Moyenne lissée : la cible calorique reste identique chaque jour, mais suit le volume réel d'entraînement.
 */
export function activityAverage(
  s: { workouts: Workout[]; cardio: CardioEntry[]; profile: Profile; bodyFatPct?: number },
  weightKg: number,
  now = new Date(),
  windowDays = 14,
): ActivityAverage {
  // Jours locaux : la fenêtre = aujourd'hui et les `days - 1` jours précédents.
  const todayKey = localDate(now);
  const bmr = computeBmr(s.profile, weightKg, s.bodyFatPct).bmr;
  const firstDates = [...s.workouts.filter((w) => w.finished).map((w) => dayKey(w.date)), ...s.cardio.map((c) => c.date)].sort();
  const sinceFirst = firstDates.length ? daysBetween(firstDates[0], todayKey) + 1 : 0;
  const days = Math.max(1, Math.min(windowDays, sinceFirst));
  const fromDate = addDays(todayKey, -days);

  const walkStats = s.cardio.filter((c) => c.date > fromDate && c.date <= todayKey && isValidCardio(c)).map((c) => cardioStats(c, s.profile, weightKg));
  const walkingTotal = walkStats.reduce((sum, c) => sum + c.kcal, 0);
  const walking = walkingTotal / days;

  const inWindow = s.workouts.filter((w) => w.finished && dayKey(w.date) > fromDate && dayKey(w.date) <= todayKey);
  const trainingTotal = inWindow.reduce((sum, w) => sum + workoutKcal(w, bmr), 0);
  let training: number;
  let source: ActivityAverage['source'];
  if (sinceFirst < 7) {
    // Pas encore une semaine d'historique : on se base sur le plan du profil.
    training = (s.profile.daysPerWeek * (RESISTANCE_MET - 1) * (bmr / 24) * (s.profile.sessionMinutes / 60)) / 7;
    source = 'plan';
  } else {
    training = trainingTotal / days;
    source = 'history';
  }
  return {
    perDay: Math.round(training + walking),
    training: Math.round(training),
    walking: Math.round(walking),
    source,
    days,
    windowDays,
    sessions: inWindow.length,
    sessionMinutes: Math.round(inWindow.reduce((sum, w) => sum + workoutMinutes(w), 0)),
    trainingTotal: Math.round(trainingTotal),
    walks: walkStats.length,
    walkMinutes: Math.round(walkStats.reduce((sum, c) => sum + c.durationMin, 0)),
    walkingTotal: Math.round(walkingTotal),
  };
}
