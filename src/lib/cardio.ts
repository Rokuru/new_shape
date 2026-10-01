import type { CardioEntry, Profile } from './types';
import { round } from './calc';

/** Cadence de marche moyenne (pas/min) quand ni la durée ni la vitesse ne sont saisies. */
const DEFAULT_CADENCE = 110;

/** Longueur de pas estimée (m) : ~41,5 % de la taille chez l'homme, 41,3 % chez la femme. */
export function strideM(profile: Profile): number {
  return (profile.heightCm / 100) * (profile.sex === 'male' ? 0.415 : 0.413);
}

export interface CardioStats {
  distanceKm: number;
  durationMin: number;
  speedKmh: number;
  /** Dénivelé positif équivalent (m). */
  elevationM: number;
  /** Calories nettes (au-delà du repos), équation de marche ACSM. */
  kcal: number;
  /** Les durée/vitesse viennent-elles d'estimations ? */
  estimated: boolean;
}

/**
 * Équation de marche de l'ACSM : VO2 (ml/kg/min) = 0,1·v + 1,8·v·pente + 3,5, v en m/min.
 * Valable surtout entre 3 et 7 km/h ; 1 L d'O2 ≈ 5 kcal. On retire la part de repos (3,5)
 * pour ne compter que la dépense due à la marche.
 */
export function cardioStats(e: CardioEntry, profile: Profile, weightKg: number): CardioStats {
  const stride = strideM(profile);
  let distanceKm = (e.steps * stride) / 1000;
  let durationMin = e.durationMin;
  let speedKmh = e.speedKmh;
  const estimated = !durationMin || !speedKmh;
  if (speedKmh && durationMin) {
    // Le tapis affiche une vitesse fiable : elle prime sur l'estimation par la longueur de pas.
    distanceKm = (speedKmh * durationMin) / 60;
  } else if (speedKmh) {
    durationMin = (distanceKm / speedKmh) * 60;
  } else if (durationMin) {
    speedKmh = distanceKm / (durationMin / 60);
  } else {
    durationMin = e.steps / DEFAULT_CADENCE;
    speedKmh = distanceKm / (durationMin / 60);
  }
  const grade = Math.max(0, Math.min(e.inclinePct, 30)) / 100;
  const vMin = (speedKmh * 1000) / 60;
  const netVo2 = 0.1 * vMin + 1.8 * vMin * grade;
  const kcal = (netVo2 * weightKg * durationMin * 5) / 1000;
  return {
    distanceKm: round(distanceKm, 2),
    durationMin: Math.round(durationMin),
    speedKmh: round(speedKmh, 1),
    elevationM: Math.round(distanceKm * 1000 * grade),
    kcal: Math.round(kcal),
    estimated,
  };
}

/** Total par jour sur les `days` derniers jours (jours sans tapis inclus, à 0). */
export function dailyTotals(entries: CardioEntry[], profile: Profile, weightKg: number, days = 14, now = new Date()) {
  const out: { date: string; steps: number; kcal: number; elevationM: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const day = entries.filter((e) => e.date === date);
    const stats = day.map((e) => cardioStats(e, profile, weightKg));
    out.push({
      date,
      steps: day.reduce((s, e) => s + e.steps, 0),
      kcal: stats.reduce((s, x) => s + x.kcal, 0),
      elevationM: stats.reduce((s, x) => s + x.elevationM, 0),
    });
  }
  return out;
}
