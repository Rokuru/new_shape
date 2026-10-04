import { addDays, dayKey } from './dates';
import type { CardioEntry, FoodEntry, Sex, Workout } from './types';

/** Ce qui a été fait un jour donné, et le niveau de flamme qui en découle (0 à 3). */
export interface DayActivity {
  /** Séance de musculation terminée. */
  sport: boolean;
  /** Activité en plus : marche ou tapis enregistrés. */
  extra: boolean;
  /** Calories mangées notées ce jour (undefined si rien n'a été noté). */
  kcal?: number;
  /** Calories dans la cible : au moins le minimum de sécurité, sans dépasser l'objectif. */
  kcalOk: boolean;
  level: 0 | 1 | 2 | 3;
}

/** Minimum de sécurité : 1 500 kcal (hommes) / 1 200 kcal (femmes), comme pour la cible calorique. */
export const kcalMin = (sex: Sex) => (sex === 'female' ? 1200 : 1500);

/**
 * Niveau de flamme par jour : +1 pour une séance, +1 pour une marche, +1 si les calories notées
 * sont entre le minimum et l'objectif. Un jour sans rien n'apparaît pas.
 */
export function activityByDay(opts: { workouts: Workout[]; cardio: CardioEntry[]; food: FoodEntry[]; sex: Sex; kcalTarget?: number }): Map<string, DayActivity> {
  const { workouts, cardio, food, sex, kcalTarget } = opts;
  const days = new Map<string, DayActivity>();
  const get = (day: string) => {
    let d = days.get(day);
    if (!d) days.set(day, (d = { sport: false, extra: false, kcalOk: false, level: 0 }));
    return d;
  };
  for (const w of workouts) if (w.finished) get(dayKey(w.date)).sport = true;
  for (const c of cardio) if ((c.durationMin ?? 0) > 0 || (c.steps ?? 0) > 0) get(c.date).extra = true;
  for (const f of food) {
    const d = get(f.date);
    d.kcal = (d.kcal ?? 0) + f.kcal;
  }
  for (const d of days.values()) {
    d.kcalOk = kcalTarget !== undefined && d.kcal !== undefined && d.kcal >= kcalMin(sex) && d.kcal <= kcalTarget;
    d.level = ((d.sport ? 1 : 0) + (d.extra ? 1 : 0) + (d.kcalOk ? 1 : 0)) as DayActivity['level'];
  }
  return days;
}

/**
 * Série en cours : jours consécutifs avec au moins une flamme.
 * Aujourd'hui ne casse pas la série tant que la journée n'est pas finie.
 */
export function currentStreak(days: Map<string, DayActivity>, today: string): number {
  const lit = (day: string) => (days.get(day)?.level ?? 0) > 0;
  let day = lit(today) ? today : addDays(today, -1);
  let n = 0;
  while (lit(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Jours affichés pour un mois (semaines du lundi au dimanche), `null` pour les cases hors du mois. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const count = new Date(year, month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= count; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
