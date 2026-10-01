import { getExercise, MUSCLES } from '../data/exercises';
import type { ActivityLevel, BodyEntry, Goal, Muscle, Profile, Workout } from './types';

export const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function ageFrom(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

/**
 * Estimation du % de masse grasse par la méthode de l'US Navy (Hodgdon & Beckett, 1984).
 * Homme : tour de taille (au nombril) et tour de cou. Femme : + tour de hanches.
 */
export function navyBodyFat(sex: Profile['sex'], heightCm: number, waistCm?: number, neckCm?: number, hipCm?: number): number | undefined {
  if (!waistCm || !neckCm || !heightCm) return undefined;
  let bf: number;
  if (sex === 'male') {
    if (waistCm <= neckCm) return undefined;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hipCm || waistCm + hipCm <= neckCm) return undefined;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return bf > 2 && bf < 70 ? round(bf) : undefined;
}

/** % de masse grasse d'une mesure : la saisie directe prime, sinon méthode Navy. */
export function bodyFatOf(entry: BodyEntry, profile: Profile): number | undefined {
  return entry.bodyFatPct ?? navyBodyFat(profile.sex, profile.heightCm, entry.waistCm, entry.neckCm, entry.hipCm);
}

export interface Composition {
  bodyFatPct?: number;
  fatKg?: number;
  leanKg?: number;
  /** Fat-Free Mass Index normalisé à 1,80 m (Kouri et al., 1995). */
  ffmi?: number;
  bmi: number;
}

export function composition(entry: BodyEntry, profile: Profile): Composition {
  const h = profile.heightCm / 100;
  const bmi = round(entry.weightKg / (h * h));
  const bf = bodyFatOf(entry, profile);
  if (bf === undefined) return { bmi };
  const fatKg = (entry.weightKg * bf) / 100;
  const leanKg = entry.weightKg - fatKg;
  const ffmi = leanKg / (h * h) + 6.1 * (1.8 - h);
  return { bodyFatPct: bf, fatKg: round(fatKg), leanKg: round(leanKg), ffmi: round(ffmi), bmi };
}

/** Moyenne mobile exponentielle (comme Happy Scale / MacroFactor) pour lisser les variations d'eau. */
export function weightTrend(entries: BodyEntry[], alpha = 0.25): { date: string; weight: number; trend: number }[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let t: number | undefined;
  return sorted.map((e) => {
    t = t === undefined ? e.weightKg : t + alpha * (e.weightKg - t);
    return { date: e.date, weight: e.weightKg, trend: round(t, 2) };
  });
}

const DAY = 86_400_000;

/** Variation de poids hebdomadaire (kg/semaine) via régression linéaire sur les `days` derniers jours. */
export function weeklyRate(entries: BodyEntry[], days = 21, now = new Date()): number | undefined {
  const cutoff = now.getTime() - days * DAY;
  const pts = entries
    .map((e) => ({ x: new Date(e.date).getTime() / DAY, y: e.weightKg }))
    .filter((p) => p.x * DAY >= cutoff);
  if (pts.length < 3) return undefined;
  const span = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  if (span < 6) return undefined;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  return den === 0 ? undefined : round((num / den) * 7, 2);
}

// ---------- Nutrition ----------

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sédentaire (bureau, < 5 000 pas)',
  light: 'Légèrement actif (5–8 000 pas)',
  moderate: 'Actif (8–12 000 pas)',
  active: 'Très actif (> 12 000 pas ou travail physique)',
  very_active: 'Extrêmement actif (athlète, travail très physique)',
};

/** Rythme de variation visé en % du poids de corps par semaine. */
export const GOAL_RATE: Record<Goal, number> = {
  cut: -0.75, // Helms et al. : 0,5–1 %/semaine pour préserver le muscle
  recomp: 0,
  bulk: 0.25, // Aragon : 0,25–0,5 %/semaine pour limiter la prise de gras
  strength: 0.1,
};

export const GOAL_LABELS: Record<Goal, string> = {
  cut: 'Sèche (perte de gras)',
  recomp: 'Recomposition',
  bulk: 'Prise de masse propre',
  strength: 'Force',
};

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  method: 'Katch-McArdle' | 'Mifflin-St Jeor';
  targetRateKg: number;
}

export function nutritionTargets(profile: Profile, latest: BodyEntry, bodyFatPct?: number, kcalAdjust = 0): NutritionTargets {
  const w = latest.weightKg;
  const age = ageFrom(profile.birthYear);
  let bmr: number;
  let method: NutritionTargets['method'];
  if (bodyFatPct !== undefined) {
    bmr = 370 + 21.6 * w * (1 - bodyFatPct / 100);
    method = 'Katch-McArdle';
  } else {
    bmr = 10 * w + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
    method = 'Mifflin-St Jeor';
  }
  const tdee = bmr * ACTIVITY_FACTORS[profile.activity];
  const targetRateKg = (GOAL_RATE[profile.goal] / 100) * w;
  // ~7 700 kcal par kg de tissu ; on plafonne le déficit à 25 % du TDEE.
  const delta = Math.max((targetRateKg * 7700) / 7, -0.25 * tdee);
  const r10 = (n: number) => Math.round(n / 10) * 10;
  const calories = r10(tdee) + r10(delta) + r10(kcalAdjust);
  // Protéines : 2,2 g/kg en sèche (Helms 2014), 1,8 g/kg sinon (Morton 2018 : plateau ≈ 1,6 g/kg).
  const proteinG = Math.round(w * (profile.goal === 'cut' ? 2.2 : 1.8));
  // Lipides : ~25 % des calories, minimum 0,6 g/kg pour la santé hormonale.
  const fatG = Math.round(Math.max((calories * 0.25) / 9, w * 0.6));
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { bmr: Math.round(bmr), tdee: r10(tdee), calories, proteinG, fatG, carbsG, method, targetRateKg: round(targetRateKg, 2) };
}

/**
 * Ajustement adaptatif des calories : compare la tendance réelle au rythme visé.
 * 1 kg/semaine d'écart ≈ 1 100 kcal/jour. Pas de 50 kcal, plafonné à ±300.
 */
export function adaptiveAdjustment(actualRateKg: number | undefined, targetRateKg: number): number {
  if (actualRateKg === undefined) return 0;
  const diff = targetRateKg - actualRateKg;
  if (Math.abs(diff) < 0.1) return 0;
  const kcal = diff * 1100;
  return Math.max(-300, Math.min(300, Math.round(kcal / 50) * 50));
}

// ---------- Performance ----------

/** 1RM estimé (Epley ≤ 10 reps, Brzycki au-delà serait trop optimiste, on borne à 12). */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return round(weight * (1 + Math.min(reps, 12) / 30));
}

export function bestE1rm(w: Workout, exerciseId: string): number {
  let best = 0;
  for (const ex of w.exercises) {
    if (ex.exerciseId !== exerciseId) continue;
    for (const s of ex.sets) if (s.done) best = Math.max(best, e1rm(s.weight, s.reps));
  }
  return best;
}

export function tonnage(w: Workout): number {
  return w.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.done ? set.weight * set.reps : 0), 0), 0);
}

/**
 * Repères de volume hebdomadaire (séries dures / semaine), d'après les “volume landmarks”
 * de Renaissance Periodization (Mike Israetel) — valeurs indicatives.
 * MEV : volume minimum efficace, MAV : zone optimale, MRV : volume maximal récupérable.
 */
export const VOLUME_LANDMARKS: Record<Muscle, { mev: number; mavLow: number; mavHigh: number; mrv: number }> = {
  chest: { mev: 8, mavLow: 12, mavHigh: 20, mrv: 22 },
  back: { mev: 10, mavLow: 14, mavHigh: 22, mrv: 25 },
  shoulders: { mev: 8, mavLow: 16, mavHigh: 22, mrv: 26 },
  biceps: { mev: 8, mavLow: 14, mavHigh: 20, mrv: 26 },
  triceps: { mev: 6, mavLow: 10, mavHigh: 14, mrv: 18 },
  quads: { mev: 8, mavLow: 12, mavHigh: 18, mrv: 20 },
  hamstrings: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  glutes: { mev: 0, mavLow: 4, mavHigh: 12, mrv: 16 },
  calves: { mev: 8, mavLow: 12, mavHigh: 16, mrv: 20 },
  abs: { mev: 0, mavLow: 16, mavHigh: 20, mrv: 25 },
};

/** Volume par muscle : 1 série pour un muscle principal, 0,5 pour un muscle secondaire. */
export function volumeFromSets(items: { exerciseId: string; sets: number }[]): Record<Muscle, number> {
  const vol = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const { exerciseId, sets } of items) {
    const e = getExercise(exerciseId);
    for (const m of e.primary) vol[m] += sets;
    for (const m of e.secondary) vol[m] += sets * 0.5;
  }
  return vol;
}

export function weeklyVolume(workouts: Workout[], now = new Date()): Record<Muscle, number> {
  const cutoff = now.getTime() - 7 * DAY;
  const items = workouts
    .filter((w) => w.finished && new Date(w.date).getTime() >= cutoff)
    .flatMap((w) => w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((s) => s.done).length })));
  return volumeFromSets(items);
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // lundi = 0
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - day);
  return r;
}
