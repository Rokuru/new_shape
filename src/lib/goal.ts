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

export interface BodyFatGoal {
  reached: boolean;
  /** Points de % restants (toujours positif). */
  remainingPts: number;
  progressPct: number;
  /** Rythme mesuré en points de % par semaine (négatif = baisse), si assez de mesures. */
  ratePerWeek?: number;
  eta?: string;
  /** Poids correspondant au % visé en gardant la masse maigre actuelle. */
  weightAtTargetKeepingLean: number;
  /** % de gras au poids visé en gardant la masse maigre actuelle. */
  bfAtTargetWeightKeepingLean?: number;
  /** Masse maigre impliquée par les deux objectifs réunis, et l'écart avec l'actuelle. */
  leanAtBoth?: number;
  leanDeltaAtBoth?: number;
  /** Part de la perte de poids qui serait de la masse maigre (0–1) si les deux objectifs sont atteints. */
  leanShareOfLoss?: number;
}

/**
 * Objectif de % de masse grasse : avancement, date estimée au rythme mesuré, et cohérence avec le poids visé.
 * En sèche, ~10 à 25 % du poids perdu est de la masse maigre (eau, glycogène, tissus de soutien) :
 * au-delà, les deux objectifs ensemble supposent de perdre du muscle.
 */
export function bodyFatGoal(opts: {
  currentBf: number;
  targetBf: number;
  startBf: number;
  weightKg: number;
  targetWeightKg?: number;
  ratePerWeek?: number;
  today: string;
}): BodyFatGoal {
  const { currentBf, targetBf, weightKg, targetWeightKg, ratePerWeek, today } = opts;
  const startBf = opts.startBf === targetBf ? currentBf : opts.startBf;
  const dir = Math.sign(targetBf - startBf) || -1;
  const reached = dir < 0 ? currentBf <= targetBf : currentBf >= targetBf;
  const remainingPts = reached ? 0 : r1(Math.abs(targetBf - currentBf));
  const span = Math.abs(targetBf - startBf);
  const progressPct = reached ? 100 : span === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((startBf - currentBf) / (startBf - targetBf)) * 100)));
  const lean = weightKg * (1 - currentBf / 100);
  const onTrack = !reached && ratePerWeek !== undefined && Math.abs(ratePerWeek) >= 0.05 && Math.sign(ratePerWeek) === dir;
  const weeks = onTrack ? remainingPts / Math.abs(ratePerWeek!) : undefined;
  const out: BodyFatGoal = {
    reached,
    remainingPts,
    progressPct,
    ratePerWeek,
    eta: weeks !== undefined && weeks <= 520 ? addDays(today, Math.round(weeks * 7)) : undefined,
    weightAtTargetKeepingLean: r1(lean / (1 - targetBf / 100)),
  };
  if (targetWeightKg !== undefined) {
    out.bfAtTargetWeightKeepingLean = r1(Math.max(0, (1 - lean / targetWeightKg) * 100));
    out.leanAtBoth = r1(targetWeightKg * (1 - targetBf / 100));
    out.leanDeltaAtBoth = r1(out.leanAtBoth - lean);
    const loss = weightKg - targetWeightKg;
    if (loss > 0) out.leanShareOfLoss = Math.round((-out.leanDeltaAtBoth / loss) * 100) / 100;
  }
  return out;
}
