import { addDays, localDate } from './dates';
import type { CardioEntry, Profile } from './types';
import { round } from './calc';

/** Cadence de marche moyenne (pas/min), utilisée seulement quand on n'a que les pas. */
const DEFAULT_CADENCE = 110;

/** Longueur de pas estimée (m) : ~41,5 % de la taille chez l'homme, 41,3 % chez la femme. */
export function strideM(profile: Profile): number {
  return (profile.heightCm / 100) * (profile.sex === 'male' ? 0.415 : 0.413);
}

/** Une marche est exploitable avec vitesse + durée, ou avec un nombre de pas. */
export const isValidCardio = (e: Pick<CardioEntry, 'speedKmh' | 'durationMin' | 'steps'>) => Boolean((e.speedKmh && e.durationMin) || e.steps);

export interface CardioStats {
  distanceKm: number;
  durationMin: number;
  speedKmh: number;
  steps: number;
  /** Pas estimés à partir de la distance (pas non saisis). */
  stepsEstimated: boolean;
  /** Dénivelé positif équivalent (m). */
  elevationM: number;
  /** Calories nettes (au-delà du repos), équation de marche ACSM. */
  kcal: number;
  /** Durée/vitesse déduites des pas (moins précis). */
  estimated: boolean;
}

/**
 * Équation de marche de l'ACSM : VO2 (ml/kg/min) = 0,1·v + 1,8·v·pente + 3,5, v en m/min.
 * Valable surtout entre 3 et 7 km/h ; 1 L d'O2 ≈ 5 kcal. On retire la part de repos (3,5)
 * pour ne compter que la dépense due à la marche.
 */
export function cardioStats(e: CardioEntry, profile: Profile, weightKg: number): CardioStats {
  const stride = strideM(profile);
  let distanceKm: number;
  let durationMin: number;
  let speedKmh: number;
  let estimated = false;
  if (e.speedKmh && e.durationMin) {
    // Cas principal : ce qu'affiche le tapis.
    speedKmh = e.speedKmh;
    durationMin = e.durationMin;
    distanceKm = (speedKmh * durationMin) / 60;
  } else {
    const steps = e.steps ?? 0;
    distanceKm = (steps * stride) / 1000;
    estimated = true;
    if (e.speedKmh) {
      speedKmh = e.speedKmh;
      durationMin = (distanceKm / speedKmh) * 60;
    } else {
      durationMin = e.durationMin ?? steps / DEFAULT_CADENCE;
      speedKmh = durationMin > 0 ? distanceKm / (durationMin / 60) : 0;
    }
  }
  const steps = e.steps ?? Math.round((distanceKm * 1000) / stride);
  const grade = Math.max(0, Math.min(e.inclinePct, 30)) / 100;
  const vMin = (speedKmh * 1000) / 60;
  const netVo2 = 0.1 * vMin + 1.8 * vMin * grade;
  const kcal = (netVo2 * weightKg * durationMin * 5) / 1000;
  return {
    distanceKm: round(distanceKm, 2),
    durationMin: Math.round(durationMin),
    speedKmh: round(speedKmh, 1),
    steps,
    stepsEstimated: e.steps === undefined,
    elevationM: Math.round(distanceKm * 1000 * grade),
    kcal: Math.max(0, Math.round(kcal)),
    estimated,
  };
}

export interface DayTotal {
  date: string;
  minutes: number;
  distanceKm: number;
  steps: number;
  kcal: number;
  elevationM: number;
}

/** Total par jour sur les `days` derniers jours (jours sans tapis inclus, à 0). */
export function dailyTotals(entries: CardioEntry[], profile: Profile, weightKg: number, days = 14, now = new Date()): DayTotal[] {
  const out: DayTotal[] = [];
  const todayKey = localDate(now);
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(todayKey, -i);
    const stats = entries.filter((e) => e.date === date && isValidCardio(e)).map((e) => cardioStats(e, profile, weightKg));
    const sum = (k: 'durationMin' | 'distanceKm' | 'steps' | 'kcal' | 'elevationM') => stats.reduce((s, x) => s + x[k], 0);
    out.push({ date, minutes: sum('durationMin'), distanceKm: round(sum('distanceKm'), 2), steps: sum('steps'), kcal: sum('kcal'), elevationM: sum('elevationM') });
  }
  return out;
}
