import { getExercise, MUSCLE_LABELS } from '../data/exercises';
import { GOAL_LABELS, VOLUME_LANDMARKS, volumeFromSets } from './calc';
import type { Equipment, Muscle, PlannedExercise, Profile, Program, ProgramDay } from './types';

/** Schémas moteurs et exercices candidats, du plus prioritaire au moins prioritaire. */
const PATTERNS = {
  squat: ['squat', 'hack_squat', 'leg_press', 'goblet_squat', 'bulgarian_split', 'pistol_squat'],
  quad_uni: ['bulgarian_split', 'leg_press', 'goblet_squat', 'pistol_squat'],
  hinge: ['deadlift', 'rdl', 'hip_thrust', 'nordic'],
  hinge_light: ['rdl', 'hip_thrust', 'nordic'],
  h_push: ['bench', 'db_bench', 'incline_db', 'pushup'],
  incline: ['incline_db', 'db_bench', 'dips', 'pushup'],
  v_push: ['ohp', 'db_ohp', 'pike_pushup'],
  h_pull: ['barbell_row', 'cable_row', 'db_row', 'inverted_row'],
  v_pull: ['pullup', 'lat_pulldown', 'chinup'],
  chest_iso: ['cable_fly', 'db_fly', 'dips', 'pushup'],
  side_delt: ['lateral_raise', 'pike_pushup'],
  rear_delt: ['face_pull', 'rear_delt_fly'],
  biceps: ['db_curl', 'barbell_curl', 'hammer_curl', 'chinup'],
  triceps: ['triceps_pushdown', 'overhead_ext', 'diamond_pushup', 'dips'],
  quad_iso: ['leg_ext', 'bulgarian_split', 'pistol_squat'],
  ham_iso: ['leg_curl', 'nordic', 'rdl'],
  glutes: ['hip_thrust', 'bulgarian_split'],
  calves: ['calf_raise'],
  abs: ['cable_crunch', 'hanging_leg_raise', 'plank'],
} as const;

type Pattern = keyof typeof PATTERNS;
type DayType = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

const DAY_TEMPLATES: Record<DayType, Pattern[]> = {
  full: ['squat', 'h_push', 'v_pull', 'hinge_light', 'v_push', 'h_pull', 'side_delt', 'biceps', 'triceps', 'calves', 'abs'],
  upper: ['h_push', 'h_pull', 'v_push', 'v_pull', 'incline', 'side_delt', 'biceps', 'triceps', 'rear_delt', 'chest_iso'],
  lower: ['squat', 'hinge', 'quad_uni', 'ham_iso', 'quad_iso', 'calves', 'abs', 'glutes'],
  push: ['h_push', 'v_push', 'incline', 'side_delt', 'triceps', 'chest_iso', 'triceps'],
  pull: ['v_pull', 'h_pull', 'h_pull', 'rear_delt', 'biceps', 'biceps', 'abs'],
  legs: ['squat', 'hinge', 'quad_uni', 'ham_iso', 'quad_iso', 'calves', 'glutes'],
};

const DAY_NAMES: Record<DayType, string> = {
  full: 'Full body',
  upper: 'Haut du corps',
  lower: 'Bas du corps',
  push: 'Push (pecs/épaules/triceps)',
  pull: 'Pull (dos/biceps)',
  legs: 'Jambes',
};

export function splitFor(days: number): { types: DayType[]; label: string } {
  switch (Math.max(2, Math.min(6, days))) {
    case 2:
      return { types: ['full', 'full'], label: 'Full body ×2' };
    case 3:
      return { types: ['full', 'full', 'full'], label: 'Full body ×3' };
    case 4:
      return { types: ['upper', 'lower', 'upper', 'lower'], label: 'Upper / Lower' };
    case 5:
      return { types: ['upper', 'lower', 'push', 'pull', 'legs'], label: 'Upper / Lower + Push / Pull / Legs' };
    default:
      return { types: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], label: 'Push / Pull / Legs ×2' };
  }
}

function pick(pattern: Pattern, equipment: Equipment, variant: number, used: Set<string>): string | undefined {
  const candidates = PATTERNS[pattern].filter((id) => getExercise(id).equipment.includes(equipment) && !used.has(id));
  if (candidates.length === 0) return undefined;
  return candidates[variant % candidates.length];
}

/** Objectif de séries hebdomadaires par muscle selon le niveau (Schoenfeld 2017 : ≥ 10 séries). */
export function weeklySetTarget(profile: Profile, m: Muscle): number {
  const base = { beginner: 10, intermediate: 14, advanced: 18 }[profile.level];
  const lm = VOLUME_LANDMARKS[m];
  const target = profile.priorities.includes(m) ? base + 4 : base;
  return Math.min(target, lm.mrv - 2);
}

function scheme(profile: Profile, compound: boolean, primaryLift: boolean): Pick<PlannedExercise, 'repMin' | 'repMax' | 'rir' | 'restSec'> {
  const lvlRir = profile.level === 'beginner' ? 2 : profile.level === 'advanced' ? 0 : 1;
  if (profile.goal === 'strength' && primaryLift) return { repMin: 3, repMax: 5, rir: 2, restSec: 210 };
  if (primaryLift) return { repMin: 5, repMax: 8, rir: Math.max(1, lvlRir), restSec: 180 };
  if (compound) return { repMin: 8, repMax: 12, rir: lvlRir, restSec: 120 };
  return { repMin: 10, repMax: 15, rir: Math.max(0, lvlRir - 1), restSec: 75 };
}

/**
 * Génère un programme personnalisé à partir du profil :
 * - split choisi selon le nombre de séances (fréquence 2×/muscle, Schoenfeld 2016),
 * - exercices filtrés selon le matériel disponible,
 * - volume ajusté au niveau et aux muscles prioritaires,
 * - nombre de séries plafonné par la durée de séance (~3,5 min par série, repos compris).
 */
export function generateProgram(profile: Profile): Program {
  const { types, label } = splitFor(profile.daysPerWeek);
  const maxSetsPerSession = Math.max(8, Math.floor(profile.sessionMinutes / 3.5));
  // Réserve de séries par séance pour les muscles prioritaires.
  const reserve = Math.min(4, profile.priorities.length * 2);
  const seen: Partial<Record<DayType, number>> = {};

  const days: ProgramDay[] = types.map((type) => {
    const variant = seen[type] ?? 0;
    seen[type] = variant + 1;
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    let total = 0;
    DAY_TEMPLATES[type].forEach((pattern, i) => {
      const id = pick(pattern, profile.equipment, variant, used);
      if (!id) return;
      const ex = getExercise(id);
      const compound = ex.kind === 'compound';
      const sets = i < 2 ? (profile.level === 'beginner' ? 3 : 4) : compound ? 3 : profile.level === 'beginner' ? 2 : 3;
      if (total + sets > maxSetsPerSession - reserve) return;
      used.add(id);
      total += sets;
      exercises.push({ exerciseId: id, sets, ...scheme(profile, compound, i === 0 && ex.increment > 0) });
    });
    const sameName = types.filter((t) => t === type).length > 1;
    return { name: `${DAY_NAMES[type]}${sameName ? ` ${String.fromCharCode(65 + variant)}` : ''}`, exercises };
  });

  boostPriorities(profile, days, maxSetsPerSession);
  balanceVolume(profile, days, maxSetsPerSession);

  return {
    id: `custom_${Date.now()}`,
    name: `Mon programme – ${label}`,
    author: 'Généré à partir de ton profil',
    description: `${GOAL_LABELS[profile.goal]}, ${profile.daysPerWeek} séances de ~${profile.sessionMinutes} min. ${
      profile.priorities.length ? `Priorités : ${profile.priorities.map((m) => MUSCLE_LABELS[m]).join(', ')}.` : ''
    }`,
    level: [profile.level],
    goals: [profile.goal],
    daysPerWeek: types.length,
    progression:
      profile.goal === 'cut'
        ? 'En sèche, l’objectif est de maintenir les charges : garde l’intensité (proche de l’échec) et réduis le volume de 1/3 si la récupération baisse.'
        : 'Double progression : quand toutes les séries atteignent le haut de la fourchette au RIR visé, ajoute la charge minimale. Décharge (volume ÷ 2) toutes les 5–6 semaines.',
    days,
    custom: true,
  };
}

/** Muscles prioritaires : jusqu'à +4 séries hebdomadaires, réparties sur les séances. */
function boostPriorities(profile: Profile, days: ProgramDay[], maxSets: number) {
  for (const m of profile.priorities) {
    let added = 0;
    for (let round = 0; round < 2 && added < 4; round++) {
      for (const day of days) {
        if (added >= 4) break;
        const dayTotal = day.exercises.reduce((s, e) => s + e.sets, 0);
        const ex = day.exercises.find((e) => getExercise(e.exerciseId).primary.includes(m) && e.sets < 5);
        if (ex && dayTotal < maxSets) {
          ex.sets += 1;
          added += 1;
        }
      }
    }
  }
}

/** Ajoute des séries aux muscles sous leur objectif hebdomadaire, dans la limite de la durée de séance. */
function balanceVolume(profile: Profile, days: ProgramDay[], maxSets: number) {
  for (let pass = 0; pass < 20; pass++) {
    const vol = volumeFromSets(days.flatMap((d) => d.exercises));
    let changed = false;
    for (const m of Object.keys(vol) as Muscle[]) {
      if (m === 'abs' || m === 'glutes') continue;
      if (vol[m] >= weeklySetTarget(profile, m)) continue;
      for (const day of days) {
        const dayTotal = day.exercises.reduce((s, e) => s + e.sets, 0);
        if (dayTotal >= maxSets) continue;
        const ex = day.exercises.find((e) => getExercise(e.exerciseId).primary.includes(m) && e.sets < 5);
        if (ex) {
          ex.sets += 1;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }
}
