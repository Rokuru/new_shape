import { addDays, dayKey, daysBetween, localDate } from './dates';
import { cardioStats, isValidCardio } from './cardio';
import type { CardioEntry, Profile, Workout } from './types';

/**
 * Dépense nette d'une séance de musculation (au-delà du repos) : ~4,5 MET sur toute la séance,
 * temps de repos compris (Compendium of Physical Activities), soit 3,5 kcal/kg/h nets.
 */
export const RESISTANCE_NET_KCAL_PER_KG_H = 3.5;

/** Durée d'une séance : celle mesurée, sinon ~3,5 min par série validée ; plafonnée à 3 h (séance non clôturée). */
export function workoutMinutes(w: Workout): number {
  const sets = w.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);
  return Math.min(180, w.durationMin && w.durationMin > 0 ? w.durationMin : sets * 3.5);
}

export function workoutKcal(w: Workout, weightKg: number): number {
  return Math.round((RESISTANCE_NET_KCAL_PER_KG_H * weightKg * workoutMinutes(w)) / 60);
}

export interface ActivityAverage {
  /** kcal/jour à ajouter à la dépense de base. */
  perDay: number;
  training: number;
  walking: number;
  /** 'history' : moyenne réelle ; 'plan' : estimée d'après le profil (pas encore assez d'historique). */
  source: 'history' | 'plan';
  days: number;
}

/**
 * Moyenne quotidienne de la dépense liée au sport (musculation + marche enregistrée) sur 14 jours.
 * Moyenne lissée : la cible calorique reste identique chaque jour, mais suit le volume réel d'entraînement.
 */
export function activityAverage(
  s: { workouts: Workout[]; cardio: CardioEntry[]; profile: Profile },
  weightKg: number,
  now = new Date(),
  windowDays = 14,
): ActivityAverage {
  // Jours locaux : la fenêtre = aujourd'hui et les `days - 1` jours précédents.
  const todayKey = localDate(now);
  const firstDates = [...s.workouts.filter((w) => w.finished).map((w) => dayKey(w.date)), ...s.cardio.map((c) => c.date)].sort();
  const sinceFirst = firstDates.length ? daysBetween(firstDates[0], todayKey) + 1 : 0;
  const days = Math.max(1, Math.min(windowDays, sinceFirst));
  const fromDate = addDays(todayKey, -days);

  const walking =
    s.cardio.filter((c) => c.date > fromDate && c.date <= todayKey && isValidCardio(c)).reduce((sum, c) => sum + cardioStats(c, s.profile, weightKg).kcal, 0) / days;

  let training: number;
  let source: ActivityAverage['source'];
  if (sinceFirst < 7) {
    // Pas encore une semaine d'historique : on se base sur le plan du profil.
    training = (s.profile.daysPerWeek * RESISTANCE_NET_KCAL_PER_KG_H * weightKg * (s.profile.sessionMinutes / 60)) / 7;
    source = 'plan';
  } else {
    training = s.workouts.filter((w) => w.finished && dayKey(w.date) > fromDate && dayKey(w.date) <= todayKey).reduce((sum, w) => sum + workoutKcal(w, weightKg), 0) / days;
    source = 'history';
  }
  return { perDay: Math.round(training + walking), training: Math.round(training), walking: Math.round(walking), source, days };
}
