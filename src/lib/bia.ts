import type { BiaData, BodyEntry, Profile, Segment } from './types';
import { ageFrom, gapAlpha, round } from './calc';

export const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'armR', label: 'Bras droit' },
  { key: 'armL', label: 'Bras gauche' },
  { key: 'trunk', label: 'Tronc' },
  { key: 'legR', label: 'Jambe droite' },
  { key: 'legL', label: 'Jambe gauche' },
];

/** Champs dans l'ordre d'affichage de la BC-545N, pour recopier sans chercher. */
export const BIA_FIELDS: { key: keyof Omit<BiaData, 'segFat' | 'segMuscle'>; label: string; min: number; max: number; step?: string; hint?: string }[] = [
  { key: 'waterPct', label: '% eau', min: 20, max: 80 },
  { key: 'muscleKg', label: 'Masse musculaire (kg)', min: 10, max: 120 },
  { key: 'physique', label: 'Masse physique (1–9)', min: 1, max: 9, step: '1' },
  { key: 'boneKg', label: 'Masse osseuse (kg)', min: 0.5, max: 8 },
  { key: 'kcal', label: 'Calories (kcal)', min: 500, max: 6000, step: '1', hint: 'métabolisme affiché par la balance' },
  { key: 'metabolicAge', label: 'Âge métabolique', min: 10, max: 99, step: '1' },
  { key: 'visceral', label: 'Graisse viscérale (1–59)', min: 1, max: 59, step: '0.5' },
];

/** Libellés officiels de l'indice « masse physique » Tanita. */
export const PHYSIQUE_LABELS: Record<number, string> = {
  1: 'Obésité cachée',
  2: 'Obèse',
  3: 'Forte corpulence',
  4: 'Manque d’exercice',
  5: 'Standard',
  6: 'Standard musclé',
  7: 'Mince',
  8: 'Mince et musclé',
  9: 'Très musclé',
};

export type Level = 'ok' | 'warn' | 'bad';

export function visceralStatus(v: number): { level: Level; label: string } {
  return v <= 12 ? { level: 'ok', label: 'Niveau sain (1–12)' } : { level: 'bad', label: 'Excès (13–59)\u00a0: à réduire' };
}

export function waterStatus(pct: number, sex: Profile['sex']): { level: Level; label: string } {
  const [lo, hi] = sex === 'male' ? [50, 65] : [45, 60];
  if (pct < lo) return { level: 'warn', label: `Bas (repère ${lo}–${hi}\u00a0%)` };
  if (pct > hi) return { level: 'warn', label: `Élevé (repère ${lo}–${hi}\u00a0%)` };
  return { level: 'ok', label: `Dans la norme (${lo}–${hi}\u00a0%)` };
}

export function metabolicAgeStatus(metabolicAge: number, profile: Profile): { level: Level; label: string } {
  const diff = metabolicAge - ageFrom(profile.birthYear);
  if (diff <= 0) return { level: 'ok', label: `${-diff} an${-diff > 1 ? 's' : ''} de moins que ton âge` };
  return { level: 'warn', label: `${diff} an${diff > 1 ? 's' : ''} de plus que ton âge` };
}

export const hasBia = (e: BodyEntry) => Boolean(e.bia && (e.bodyFatPct !== undefined || Object.keys(e.bia).length));

/** Moyenne mobile exponentielle d'une valeur BIA (l'impédance varie avec l'hydratation d'un jour à l'autre). */
export function biaTrend(entries: BodyEntry[], pick: (e: BodyEntry) => number | undefined, alpha = 0.3): Map<string, number> {
  const out = new Map<string, number>();
  let t: number | undefined;
  let prev: string | undefined;
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const v = pick(e);
    if (v === undefined) continue;
    // Mesures balance hebdomadaires en général ; après 60 jours sans mesure, la tendance repart de la mesure.
    const gap = prev ? Math.round((new Date(e.date).getTime() - new Date(prev).getTime()) / 86_400_000) : 0;
    t = t === undefined ? v : t + gapAlpha(alpha, gap, 7, 60) * (v - t);
    prev = e.date;
    out.set(e.date, round(t, 2));
  }
  return out;
}

export interface SegmentRow {
  key: Segment;
  label: string;
  fatPct?: number;
  muscleKg?: number;
  muscleDelta?: number;
}

/** Dernière analyse segmentaire et évolution du muscle depuis la première. */
export function segmentAnalysis(entries: BodyEntry[]): { date: string; rows: SegmentRow[]; asymmetries: string[] } | undefined {
  const withSeg = [...entries].filter((e) => e.bia?.segMuscle || e.bia?.segFat).sort((a, b) => a.date.localeCompare(b.date));
  const last = withSeg.at(-1);
  if (!last) return undefined;
  const first = withSeg[0];
  const rows = SEGMENTS.map(({ key, label }) => {
    const m = last.bia?.segMuscle?.[key];
    const m0 = first.bia?.segMuscle?.[key];
    return { key, label, fatPct: last.bia?.segFat?.[key], muscleKg: m, muscleDelta: m !== undefined && m0 !== undefined && first !== last ? round(m - m0, 2) : undefined };
  });
  const asymmetries: string[] = [];
  for (const [r, l, name] of [['armR', 'armL', 'bras'], ['legR', 'legL', 'jambes']] as const) {
    const mr = last.bia?.segMuscle?.[r];
    const ml = last.bia?.segMuscle?.[l];
    if (mr && ml) {
      const diff = (Math.abs(mr - ml) / Math.max(mr, ml)) * 100;
      // Au-delà de ~5–10 %, l'écart dépasse la latéralité normale (côté dominant).
      if (diff >= 8) asymmetries.push(`Écart de ${round(diff, 0)} % entre les ${name} (côté ${mr > ml ? 'droit' : 'gauche'} plus fort) : ajoute du travail unilatéral en commençant par le côté faible.`);
    }
  }
  return { date: last.date, rows, asymmetries };
}
