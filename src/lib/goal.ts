import { addDays } from './dates';

export type GoalStatus = 'reached' | 'on_track' | 'wrong_way' | 'flat' | 'unknown';

export interface GoalMilestone {
  kg: number;
  reached: boolean;
  /** Date estimée (YYYY-MM-DD) au rythme actuel, si la tendance va dans le bon sens. */
  eta?: string;
}

export interface GoalProjection {
  status: GoalStatus;
  /** Kilos restants (toujours positif). */
  remainingKg: number;
  /** Avancement entre le poids de départ et l'objectif, 0 à 100. */
  progressPct: number;
  weeks?: number;
  eta?: string;
  milestones: GoalMilestone[];
  /** Rythme au-delà de 1 % du poids par semaine : risque de perdre du muscle. */
  tooFast: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Projection vers un poids objectif à partir de la tendance réelle (kg/semaine).
 * Au-delà de 10 ans on considère la tendance comme stable : une date si lointaine n'a pas de sens.
 */
export function goalProjection(opts: { currentKg: number; targetKg: number; startKg: number; ratePerWeek?: number; today: string; step?: number }): GoalProjection {
  const { currentKg, targetKg, today, ratePerWeek: rate } = opts;
  const startKg = opts.startKg === targetKg ? currentKg : opts.startKg;
  const step = opts.step ?? 5;
  const dir = Math.sign(targetKg - startKg) || Math.sign(targetKg - currentKg) || -1;
  const reached = dir < 0 ? currentKg <= targetKg : currentKg >= targetKg;
  const remainingKg = reached ? 0 : r1(Math.abs(targetKg - currentKg));
  const span = Math.abs(targetKg - startKg);
  const progressPct = reached ? 100 : span === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((startKg - currentKg) / (startKg - targetKg)) * 100)));
  const tooFast = rate !== undefined && dir < 0 && -rate > currentKg * 0.01;

  let status: GoalStatus;
  if (reached) status = 'reached';
  else if (rate === undefined) status = 'unknown';
  else if (Math.abs(rate) < 0.05 || remainingKg / Math.abs(rate) > 520) status = 'flat';
  else if (Math.sign(rate) !== dir) status = 'wrong_way';
  else status = 'on_track';

  const etaFor = (kg: number) => (status === 'on_track' && rate ? addDays(today, Math.round((Math.abs(kg - currentKg) / Math.abs(rate)) * 7)) : undefined);
  const isReached = (kg: number) => (dir < 0 ? currentKg <= kg : currentKg >= kg);

  // Paliers ronds (multiples de `step`) entre le départ et l'objectif, puis l'objectif lui-même.
  const milestones: GoalMilestone[] = [];
  const lo = Math.min(startKg, targetKg);
  const hi = Math.max(startKg, targetKg);
  for (let kg = Math.ceil((lo + 0.01) / step) * step; kg < hi; kg += step) milestones.push({ kg, reached: isReached(kg), eta: isReached(kg) ? undefined : etaFor(kg) });
  if (dir < 0) milestones.reverse();
  milestones.push({ kg: targetKg, reached, eta: reached ? undefined : etaFor(targetKg) });

  const weeks = status === 'on_track' && rate ? r1(remainingKg / Math.abs(rate)) : undefined;
  return { status, remainingKg, progressPct, weeks, eta: etaFor(targetKg), milestones, tooFast };
}
