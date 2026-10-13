/**
 * Plans objectifs : semaine en cours, phase, ajustements automatiques (séries plafonnées, semaine allégée),
 * calculs de l'objectif et suivi mensuel, à partir du profil et des données de l'utilisateur.
 */
import { PLAN_TEMPLATES, type PlanPhase, type PlanTable, type PlanTemplate } from '../data/plans';
import { getExercise } from '../data/exercises';
import { bodyFatOf, bodyweightAt, computeBmr, setE1rm } from './calc';
import { addDays, dayKey, daysBetween, parseLocalDate } from './dates';
import type { BodyEntry, LoggedSet, Profile, Program, Workout } from './types';

export const planTemplate = (id: string | undefined): PlanTemplate | undefined => PLAN_TEMPLATES.find((t) => t.id === id);

export const planProgramId = (tpl: PlanTemplate, phase: PlanPhase) => `plan-${tpl.id}-${phase.id}`;

/** Programme d'une phase, utilisable comme n'importe quel programme (séance, suggestions de charge…). */
export function phaseProgram(tpl: PlanTemplate, phase: PlanPhase): Program {
  const n = tpl.phases.indexOf(phase) + 1;
  return {
    id: planProgramId(tpl, phase),
    name: `Phase ${n} – ${phase.name} (S${phase.weeks[0]}–S${phase.weeks[1]})`,
    author: `Plan objectif : ${tpl.name}`,
    description: phase.summary,
    level: [tpl.profile.level],
    goals: [tpl.profile.goal],
    daysPerWeek: phase.days.length,
    progression: 'Double progression : même charge jusqu’au haut de la fourchette sur toutes les séries, puis +2,5 à 5 kg (machine) ou +1 à 2 kg par haltère.',
    days: phase.days,
  };
}

export const PLAN_PROGRAMS: Program[] = PLAN_TEMPLATES.flatMap((t) => t.phases.map((p) => phaseProgram(t, p)));

/** Semaine du plan (S1 = les 7 jours à partir du départ) ; 0 ou moins avant le départ. */
export function planWeek(start: string, day: string): number {
  return Math.floor(daysBetween(start, day) / 7) + 1;
}

/** Phase d'une semaine, bornée à la première et à la dernière phase. */
export function phaseForWeek(tpl: PlanTemplate, week: number): PlanPhase {
  return tpl.phases.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? (week < 1 ? tpl.phases[0] : tpl.phases.at(-1)!);
}

export const phaseDates = (start: string, phase: PlanPhase) => ({ from: addDays(start, (phase.weeks[0] - 1) * 7), to: addDays(start, phase.weeks[1] * 7 - 1) });
export const planEnd = (tpl: PlanTemplate, start: string) => addDays(start, tpl.weeks * 7 - 1);

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
/** Jour de la semaine, lundi = 0. */
const weekday = (day: string) => (parseLocalDate(day).getDay() + 6) % 7;

/** Lundi qui suit (ou aujourd'hui si on est lundi) : départ proposé. */
export function nextMonday(day: string): string {
  const dow = weekday(day);
  return dow === 0 ? day : addDays(day, 7 - dow);
}

/** « du mercredi au mardi » : les 7 jours d'une semaine du plan, qui commence le jour du départ. */
export function weekSpan(start: string): string {
  const first = weekday(start);
  return `du ${WEEKDAYS[first]} au ${WEEKDAYS[(first + 6) % 7]}`;
}

/** Jours de séance dans l'ordre d'une semaine du plan : départ un mercredi → mercredi, vendredi, lundi. */
export function sessionDaysFrom(tpl: PlanTemplate, start?: string): string[] {
  if (!start) return tpl.sessionDays;
  const pos = (d: string) => (WEEKDAYS.indexOf(d) - weekday(start) + 7) % 7;
  return [...tpl.sessionDays].sort((a, b) => pos(a) - pos(b));
}

/**
 * Semaine type recalée sur le jour du départ : les lignes partent de ce jour, et les séances (1re, 2e, 3e,
 * ou Haut, Bas…) suivent l'ordre de la semaine du plan. Départ un lundi : la semaine type telle quelle.
 */
export function weekTypeFrom(tpl: PlanTemplate, start?: string): PlanTable {
  const { rows } = tpl.weekType;
  if (!start || !rows.every((r) => WEEKDAYS.includes(r[0].toLowerCase()))) return tpl.weekType;
  const order = sessionDaysFrom(tpl, start);
  const rowOf = (d: string) => rows.find((r) => r[0].toLowerCase() === d);
  const pos = (r: string[]) => (WEEKDAYS.indexOf(r[0].toLowerCase()) - weekday(start) + 7) % 7;
  return {
    ...tpl.weekType,
    rows: rows
      .map((r) => {
        const k = order.indexOf(r[0].toLowerCase());
        const src = k >= 0 ? rowOf(tpl.sessionDays[k]) : undefined;
        return src ? [r[0], ...src.slice(1)] : r;
      })
      .sort((a, b) => pos(a) - pos(b)),
  };
}

export interface PlanStatus {
  tpl: PlanTemplate;
  start: string;
  end: string;
  /** Semaine du plan (bornée entre 0 avant le départ et le nombre de semaines + 1 après la fin). */
  week: number;
  phase: PlanPhase;
  phaseIndex: number;
  started: boolean;
  finished: boolean;
}

export function planStatus(profile: Profile, day: string): PlanStatus | undefined {
  const tpl = planTemplate(profile.plan?.id);
  if (!tpl || !profile.plan) return undefined;
  const start = profile.plan.start;
  const raw = planWeek(start, day);
  const phase = phaseForWeek(tpl, raw);
  return { tpl, start, end: planEnd(tpl, start), week: Math.max(0, Math.min(tpl.weeks + 1, raw)), phase, phaseIndex: tpl.phases.indexOf(phase), started: raw >= 1, finished: raw > tpl.weeks };
}

/** Programme que le plan veut actif ce jour-là (phase 1 avant le départ, dernière phase après la fin). */
export function planProgramFor(profile: Profile, day: string): string | undefined {
  const st = planStatus(profile, day);
  return st && planProgramId(st.tpl, st.phase);
}

export interface PlanAdjust {
  maxSets?: number;
  deload?: boolean;
  /** Texte affiché pendant la séance. */
  label: string;
}

/**
 * Ajustements automatiques d'une séance du plan : séries plafonnées (ex. 2 séries en S1–S2)
 * ou semaine allégée (une série de moins, charges −10 %). Seulement pour la phase de ce programme.
 */
export function planAdjust(profile: Profile, programId: string | undefined, day: string): PlanAdjust | undefined {
  const tpl = planTemplate(profile.plan?.id);
  if (!tpl || !profile.plan || !programId) return undefined;
  const phase = tpl.phases.find((p) => planProgramId(tpl, p) === programId);
  if (!phase) return undefined;
  const week = Math.max(1, planWeek(profile.plan.start, day));
  if (phase.deloadWeek === week) return { deload: true, label: `Semaine allégée (S${week}) : une série de moins et charges −10 %, déjà appliqués.` };
  const cap = phase.capSets;
  if (cap && week >= cap.weeks[0] && week <= cap.weeks[1]) return { maxSets: cap.sets, label: `S${week} : ${cap.sets} séries par exercice (S${cap.weeks[0]}–S${cap.weeks[1]}), déjà appliqué.` };
  return undefined;
}

/** Applique un ajustement aux séries pré-remplies : plafond, ou une série de moins et charges −10 % arrondies à l'incrément. */
export function adjustSets(exerciseId: string, sets: LoggedSet[], adj: PlanAdjust | undefined): LoggedSet[] {
  if (!adj) return sets;
  if (adj.maxSets) return sets.slice(0, adj.maxSets);
  if (!adj.deload) return sets;
  const inc = getExercise(exerciseId).increment;
  return sets.slice(0, Math.max(1, sets.length - 1)).map((s) => ({ ...s, weight: inc > 0 ? Math.round((s.weight * 0.9) / inc) * inc : s.weight }));
}

/** Nom court d'une séance : « Séance A – poussée… » → « A », « Séance métabolique » → « Métabolique ». */
export function shortSessionName(name: string): string {
  const s = name.replace(/^Séance /, '').split(' – ')[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Séances prévues une semaine donnée, une par jour de séance (lundi, mercredi, vendredi, dans l'ordre de la semaine
 * du plan qui part du jour du départ) : les séances de la phase tournent (phase 1 : A-B-A puis B-A-B ; phase 2 : A-B-C).
 */
export function weekSessions(tpl: PlanTemplate, week: number, start?: string): { day: string; name: string }[] {
  const phase = phaseForWeek(tpl, week);
  const days = sessionDaysFrom(tpl, start);
  const offset = (Math.max(week, phase.weeks[0]) - phase.weeks[0]) * days.length;
  return days.map((day, i) => ({ day, name: shortSessionName(phase.days[(offset + i) % phase.days.length].name) }));
}

/** Semaines du plan qui contiennent le 25 décembre ou le 1er janvier (séances souvent décalées). */
export function holidayWeeks(tpl: PlanTemplate, start: string): number[] {
  const weeks = new Set<number>();
  for (let w = 1; w <= tpl.weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const md = addDays(start, (w - 1) * 7 + d).slice(5);
      if (md === '12-25' || md === '01-01') weeks.add(w);
    }
  }
  return [...weeks];
}

// ---------- Objectif ----------

export interface GoalMath {
  targetFatKg: number;
  minLeanKg: number;
  /** Masse maigre qu'on peut perdre au maximum (négatif : il faudrait en gagner). */
  maxLeanLossKg?: number;
  toLoseKg: number;
  kcal: number;
  /** Déficit quotidien nécessaire et rythme moyen sur la durée du plan, et sur 6 mois. */
  deficitPlan: number;
  ratePlan: number;
  deficit6m: number;
}

/** 7 700 kcal par kg perdu, comme dans le reste de l'app. */
export function goalMath(current: { weightKg: number; leanKg?: number }, target: { weightKg: number; bodyFatPct: number }, weeks: number): GoalMath {
  const targetFatKg = (target.weightKg * target.bodyFatPct) / 100;
  const minLeanKg = target.weightKg - targetFatKg;
  const toLoseKg = Math.max(0, current.weightKg - target.weightKg);
  const kcal = toLoseKg * 7700;
  return {
    targetFatKg,
    minLeanKg,
    maxLeanLossKg: current.leanKg !== undefined ? current.leanKg - minLeanKg : undefined,
    toLoseKg,
    kcal,
    deficitPlan: kcal / (weeks * 7),
    ratePlan: toLoseKg / weeks,
    deficit6m: kcal / 182,
  };
}

/** Repères caloriques du plan : métabolisme × 1,4–1,5, déficit du plan, protéines ≈ 2 g par kg de masse maigre. */
export function planEnergy(profile: Profile, weightKg: number, bodyFatPct: number | undefined, leanKg: number | undefined, deficit: number) {
  const bmr = computeBmr(profile, weightKg, bodyFatPct);
  const tdee: [number, number] = [bmr.bmr * 1.4, bmr.bmr * 1.5];
  const lighter = computeBmr(profile, weightKg - 5, bodyFatPct).bmr;
  return {
    bmr: bmr.bmr,
    method: bmr.method,
    tdee,
    intake: [tdee[0] - deficit, tdee[1] - deficit] as [number, number],
    protein: leanKg ? ([leanKg * 2, leanKg * 2.3] as [number, number]) : undefined,
    per5kg: (bmr.bmr - lighter) * 1.4,
  };
}

/** Poids prévu un jour donné : ligne droite du départ à l'objectif sur la durée du plan. */
export function expectedWeight(start: string, end: string, startKg: number, targetKg: number, day: string): number {
  const total = daysBetween(start, end);
  const t = Math.min(1, Math.max(0, daysBetween(start, day) / total));
  return startKg + (targetKg - startKg) * t;
}

/** Dates de suivi : chaque mois à la date du départ, jusqu'à une semaine après la fin du plan. */
export function checkpoints(tpl: PlanTemplate, start: string): string[] {
  const end = addDays(planEnd(tpl, start), 7);
  const [y, m, d] = start.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const date = new Date(y, m - 1 + i, d);
    // Mois plus court (départ un 31) : on prend le dernier jour du mois.
    if (date.getDate() !== d) date.setDate(0);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (day > end) break;
    out.push(day);
  }
  return out;
}

export interface TrackingRow {
  date: string;
  expectedKg: number;
  /** Moyenne des pesées des 7 jours précédents (date incluse). */
  avgKg?: number;
  waistCm?: number;
  bodyFatPct?: number;
  /** Meilleure série des 14 jours précédents, par exercice suivi. */
  lifts: { label: string; set?: LoggedSet }[];
  future: boolean;
}

/** Tableau de suivi mensuel rempli à partir des pesées, mesures et séances. */
export function trackingRows(
  tpl: PlanTemplate,
  start: string,
  data: { profile: Profile; body: BodyEntry[]; workouts: Workout[]; startKg: number; targetKg: number },
  today: string,
): TrackingRow[] {
  const end = planEnd(tpl, start);
  const near = (date: string, days: number) => data.body.filter((e) => Math.abs(daysBetween(e.date, date)) <= days).sort((a, b) => Math.abs(daysBetween(a.date, date)) - Math.abs(daysBetween(b.date, date)));
  return checkpoints(tpl, start).map((date) => {
    const future = date > today;
    const week = data.body.filter((e) => e.date <= date && daysBetween(e.date, date) < 7);
    const sized = near(date, 10);
    const lifts = tpl.tracked.map(({ id, label }) => {
      let best: { v: number; set?: LoggedSet } = { v: 0 };
      for (const w of data.workouts) {
        const day = dayKey(w.date);
        if (!w.finished || day > date || daysBetween(day, date) >= 14) continue;
        for (const e of w.exercises)
          if (e.exerciseId === id)
            for (const s of e.sets) {
              const v = s.done ? setE1rm(id, s.weight, s.reps, bodyweightAt(data.body, w.date)) : 0;
              if (v > best.v) best = { v, set: s };
            }
      }
      return { label, set: best.set };
    });
    return {
      date,
      expectedKg: expectedWeight(start, end, data.startKg, data.targetKg, date),
      avgKg: !future && week.length ? week.reduce((s, e) => s + e.weightKg, 0) / week.length : undefined,
      waistCm: future ? undefined : sized.find((e) => e.waistCm !== undefined)?.waistCm,
      bodyFatPct: future ? undefined : sized.map((e) => bodyFatOf(e, data.profile)).find((v) => v !== undefined),
      lifts: future ? lifts.map((l) => ({ label: l.label })) : lifts,
      future,
    };
  });
}
