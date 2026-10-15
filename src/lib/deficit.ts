/**
 * Calories à perdre : l'objectif (gras à perdre × 7 700 kcal) et le déficit compté jour par jour depuis le départ,
 * dépense estimée (maintenance de l'onglet Nutrition, avec le sport réel du jour) moins les calories notées.
 */
import { ACTIVITY_FACTORS, computeBmr, currentComposition } from './calc';
import { cardioStats, isValidCardio } from './cardio';
import { addDays, dayKey, daysBetween } from './dates';
import { workoutKcal } from './energy';
import { planEnd, planTemplate } from './plan';
import type { BodyEntry, CardioEntry, FoodEntry, Profile, Workout } from './types';

/** Énergie d'un kilo de tissu adipeux perdu, comme dans le reste de l'app. */
export const KCAL_PER_KG = 7700;

export interface KcalGoal {
  /** 'fat' : gras à perdre (poids et % de gras du départ et visés) ; 'weight' : poids à perdre, faute de % de gras. */
  basis: 'fat' | 'weight';
  startKg: number;
  targetKg: number;
  startBf?: number;
  targetBf?: number;
  startFatKg?: number;
  targetFatKg?: number;
  /** Kilos à perdre : de gras, ou de poids sans % de gras. */
  toLoseKg: number;
  kcal: number;
}

/** Composition au jour donné : dernière pesée et dernier % de gras connus ce jour-là (sinon les premiers relevés). */
function compositionOn(sortedBody: BodyEntry[], profile: Profile, day: string) {
  const upTo = sortedBody.filter((e) => e.date <= day);
  return currentComposition(upTo.length ? upTo : sortedBody.slice(0, 1), profile);
}

/** Départ du compteur : le départ du plan s'il y en a un, sinon le jour où l'objectif a été fixé. */
export function deficitStart(profile: Profile): string | undefined {
  return profile.plan?.start ?? profile.targetSetAt;
}

/**
 * Total à perdre pour atteindre l'objectif : (gras au départ − gras visé) × 7 700 kcal.
 * Sans % de gras visé ou mesuré : (poids de départ − poids visé) × 7 700. Rien pour un objectif de prise.
 */
export function kcalGoal(profile: Profile, body: BodyEntry[]): KcalGoal | undefined {
  const targetKg = profile.targetWeightKg;
  if (targetKg === undefined) return undefined;
  const sorted = [...body].sort((a, b) => a.date.localeCompare(b.date));
  const from = deficitStart(profile);
  const atStart = from ? compositionOn(sorted, profile, from) : currentComposition(sorted, profile);
  const startKg = profile.targetStartKg ?? atStart?.weightKg;
  if (startKg === undefined) return undefined;
  const startBf = profile.targetStartBfPct ?? atStart?.bodyFatPct;
  const targetBf = profile.targetBodyFatPct;
  if (targetBf !== undefined && startBf !== undefined) {
    const startFatKg = (startKg * startBf) / 100;
    const targetFatKg = (targetKg * targetBf) / 100;
    const toLoseKg = startFatKg - targetFatKg;
    return toLoseKg > 0.05 ? { basis: 'fat', startKg, targetKg, startBf, targetBf, startFatKg, targetFatKg, toLoseKg, kcal: toLoseKg * KCAL_PER_KG } : undefined;
  }
  const toLoseKg = startKg - targetKg;
  return toLoseKg > 0.05 ? { basis: 'weight', startKg, targetKg, toLoseKg, kcal: toLoseKg * KCAL_PER_KG } : undefined;
}

export interface DeficitDay {
  date: string;
  eaten: number;
  bmr: number;
  /** Métabolisme de base × activité quotidienne (hors sport). */
  base: number;
  /** Séances et marche du jour, au-delà du repos. */
  sport: number;
  burned: number;
  /** Dépense − mangé : positif = déficit. */
  deficit: number;
}

export interface DeficitTally {
  from: string;
  /** Jours comptés : journées passées avec des repas notés. */
  days: DeficitDay[];
  total: number;
  /** Journées ignorées : moins de la moitié du métabolisme de base noté (repas oubliés). */
  partial: string[];
  /** Journées passées sans aucun repas noté. */
  missing: number;
  /** Calories notées aujourd'hui : la journée en cours compte le lendemain. */
  eatenToday: number;
}

/**
 * Déficit jour par jour du départ à hier : dépense estimée (métabolisme de base × activité quotidienne, comme la
 * maintenance de l'onglet Nutrition, + séances et marche du jour) moins les calories notées.
 */
export function deficitTally(
  data: { profile: Profile; body: BodyEntry[]; food: FoodEntry[]; workouts: Workout[]; cardio: CardioEntry[] },
  from: string,
  today: string,
): DeficitTally {
  const { profile } = data;
  const sorted = [...data.body].sort((a, b) => a.date.localeCompare(b.date));
  const eatenOn = new Map<string, number>();
  for (const f of data.food) if (f.date >= from && f.date <= today) eatenOn.set(f.date, (eatenOn.get(f.date) ?? 0) + f.kcal);
  const days: DeficitDay[] = [];
  const partial: string[] = [];
  let missing = 0;
  for (let d = from; d < today; d = addDays(d, 1)) {
    const eaten = eatenOn.get(d);
    const comp = eaten !== undefined ? compositionOn(sorted, profile, d) : undefined;
    if (eaten === undefined || !comp) {
      missing++;
      continue;
    }
    const bmr = computeBmr(profile, comp.weightKg, comp.bodyFatPct).bmr;
    if (eaten < bmr / 2) {
      partial.push(d);
      continue;
    }
    const sport =
      data.workouts.filter((w) => w.finished && dayKey(w.date) === d).reduce((s, w) => s + workoutKcal(w, bmr), 0) +
      data.cardio.filter((c) => c.date === d && isValidCardio(c)).reduce((s, c) => s + cardioStats(c, profile, comp.weightKg).kcal, 0);
    const base = bmr * ACTIVITY_FACTORS[profile.activity];
    const burned = base + sport;
    days.push({ date: d, eaten, bmr, base, sport, burned, deficit: burned - eaten });
  }
  return { from, days, total: days.reduce((s, x) => s + x.deficit, 0), partial, missing, eatenToday: eatenOn.get(today) ?? 0 };
}

export interface DeficitSummary {
  goal: KcalGoal;
  tally: DeficitTally;
  /** Avancement (0 à 100). */
  pct: number;
  /** Équivalent en gras du déficit compté. */
  fatKg: number;
  /** Déficit moyen des jours comptés. */
  avgPerDay?: number;
  /** Avec un plan : déficit quotidien nécessaire, d'aujourd'hui à la fin du plan, pour atteindre l'objectif. */
  neededPerDay?: number;
  planEnd?: string;
  /** Date d'arrivée si le rythme moyen se maintient chaque jour. */
  eta?: string;
  reached: boolean;
  /** Le compteur démarre plus tard (départ du plan à venir). */
  notStarted: boolean;
}

export function deficitSummary(data: { profile: Profile; body: BodyEntry[]; food: FoodEntry[]; workouts: Workout[]; cardio: CardioEntry[] }, today: string): DeficitSummary | undefined {
  const goal = kcalGoal(data.profile, data.body);
  const from = deficitStart(data.profile);
  if (!goal || !from || !data.body.length) return undefined;
  const tally = deficitTally(data, from, today);
  const avgPerDay = tally.days.length ? tally.total / tally.days.length : undefined;
  const remaining = goal.kcal - tally.total;
  const tpl = planTemplate(data.profile.plan?.id);
  const end = tpl && data.profile.plan ? planEnd(tpl, data.profile.plan.start) : undefined;
  const daysLeft = end ? daysBetween(today < from ? from : today, end) + 1 : 0;
  return {
    goal,
    tally,
    pct: Math.min(100, Math.max(0, (tally.total / goal.kcal) * 100)),
    fatKg: tally.total / KCAL_PER_KG,
    avgPerDay,
    neededPerDay: remaining > 0 && daysLeft > 0 ? remaining / daysLeft : undefined,
    planEnd: end,
    eta: remaining > 0 && avgPerDay !== undefined && avgPerDay > 0 ? addDays(today, Math.ceil(remaining / avgPerDay)) : undefined,
    reached: remaining <= 0,
    notStarted: daysBetween(today, from) > 0,
  };
}
