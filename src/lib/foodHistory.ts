import { addDays, daysBetween, parseLocalDate } from './dates';
import type { FoodEntry } from './types';

/** Période de l'historique des repas : derniers jours, ou depuis le premier repas noté. */
export type FoodRange = 7 | 30 | 'all';

export interface FoodDay {
  date: string;
  kcal: number;
  proteinG: number;
}

/** Moyennes par jour sur les journées notées et finies : aujourd'hui est exclu, la journée n'est pas finie. */
export interface FoodAverages {
  /** Journées notées prises en compte. */
  logged: number;
  kcal?: number;
  proteinG?: number;
  /** Journées au-dessus de la cible calorique. */
  over: number;
}

export interface FoodWeek extends FoodAverages {
  /** Lundi de la semaine (AAAA-MM-JJ). */
  monday: string;
  days: FoodDay[];
}

export interface FoodPeriod extends FoodAverages {
  /** Du plus récent (aujourd'hui) au plus ancien, jours sans repas compris. */
  days: FoodDay[];
  weeks: FoodWeek[];
}

/** Lundi de la semaine d'un jour (AAAA-MM-JJ). */
export const mondayOf = (day: string) => addDays(day, -((parseLocalDate(day).getDay() + 6) % 7));

function averages(days: FoodDay[], today: string, target: number): FoodAverages {
  const done = days.filter((d) => d.date !== today && d.kcal > 0);
  if (!done.length) return { logged: 0, over: 0 };
  const mean = (k: 'kcal' | 'proteinG') => done.reduce((s, d) => s + d[k], 0) / done.length;
  return { logged: done.length, kcal: mean('kcal'), proteinG: mean('proteinG'), over: done.filter((d) => d.kcal > target).length };
}

/**
 * Historique des repas jour par jour : les `range` derniers jours, ou depuis le premier repas noté ('all'),
 * avec les moyennes de la période et un regroupement par semaine (lundi → dimanche).
 */
export function foodPeriod(food: FoodEntry[], today: string, range: FoodRange, target: number): FoodPeriod {
  const totals = new Map<string, FoodDay>();
  for (const f of food) {
    if (f.date > today) continue;
    const t = totals.get(f.date) ?? { date: f.date, kcal: 0, proteinG: 0 };
    t.kcal += f.kcal;
    t.proteinG += f.proteinG ?? 0;
    totals.set(f.date, t);
  }
  const first = [...totals.keys()].reduce((min, d) => (d < min ? d : min), today);
  const length = range === 'all' ? daysBetween(first, today) + 1 : range;
  const days = Array.from({ length }, (_, i) => {
    const date = addDays(today, -i);
    return totals.get(date) ?? { date, kcal: 0, proteinG: 0 };
  });
  const weeks: FoodWeek[] = [];
  for (const d of days) {
    const monday = mondayOf(d.date);
    const w = weeks.at(-1);
    if (w?.monday === monday) w.days.push(d);
    else weeks.push({ monday, days: [d], logged: 0, over: 0 });
  }
  return { days, weeks: weeks.map((w) => ({ ...w, ...averages(w.days, today, target) })), ...averages(days, today, target) };
}
