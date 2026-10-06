import { getExercise, MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { GOAL_LABELS, VOLUME_LANDMARKS, volumeFromSets } from './calc';
import type { Equipment, Muscle, PlannedExercise, Profile, Program, ProgramDay, SplitPref } from './types';

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
type DayType = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'chest_back' | 'shoulders_arms';

/** Équivalents sur machines guidées (Basic-Fit et la plupart des salles), utilisés avec « machines de préférence ». */
const MACHINE_ALT: Partial<Record<Pattern, string[]>> = {
  squat: ['leg_press', 'hack_squat', 'm_vertical_leg_press', 'm_smith_squat'],
  quad_uni: ['m_vertical_leg_press', 'leg_press'],
  hinge: ['m_hip_thrust'],
  hinge_light: ['leg_curl', 'm_lying_leg_curl'],
  h_push: ['m_chest_press'],
  incline: ['pec_deck', 'm_chest_press'],
  v_push: ['m_shoulder_press'],
  h_pull: ['m_seated_row'],
  v_pull: ['lat_pulldown'],
  chest_iso: ['pec_deck'],
  rear_delt: ['m_rear_delt'],
  biceps: ['m_arm_curl'],
  triceps: ['m_triceps_press'],
  quad_iso: ['leg_ext'],
  ham_iso: ['leg_curl', 'm_lying_leg_curl'],
  glutes: ['m_hip_thrust', 'm_glute'],
  calves: ['m_standing_calf', 'seated_calf'],
  abs: ['m_ab_crunch'],
};

/**
 * Chaque séance est construite par paliers :
 * 1. mouvements de base (toujours présents),
 * 2. isolation essentielle (deltoïdes latéraux, bras, ischios, mollets),
 * 3. compléments si la durée de séance le permet.
 */
const DAY_TEMPLATES: Record<DayType, Pattern[][]> = {
  full: [
    ['squat', 'h_push', 'v_pull', 'hinge_light'],
    ['v_push', 'h_pull', 'side_delt'],
    ['biceps', 'triceps', 'calves', 'abs'],
  ],
  upper: [
    ['h_push', 'h_pull', 'v_push', 'v_pull'],
    ['side_delt', 'biceps', 'triceps'],
    ['incline', 'rear_delt', 'chest_iso'],
  ],
  lower: [
    ['squat', 'hinge'],
    ['ham_iso', 'quad_uni', 'calves'],
    ['quad_iso', 'abs', 'glutes'],
  ],
  push: [
    ['h_push', 'v_push'],
    ['incline', 'side_delt', 'triceps'],
    ['chest_iso', 'triceps'],
  ],
  pull: [
    ['v_pull', 'h_pull'],
    ['rear_delt', 'biceps', 'h_pull'],
    ['biceps', 'abs'],
  ],
  legs: [
    ['squat', 'hinge'],
    ['quad_uni', 'ham_iso', 'calves'],
    ['quad_iso', 'glutes', 'abs'],
  ],
  // Split par muscle : un ou deux groupes par séance, plus d'exercices pour chacun.
  chest: [
    ['h_push', 'incline'],
    ['chest_iso', 'triceps'],
    ['triceps', 'chest_iso'],
  ],
  back: [
    ['v_pull', 'h_pull'],
    ['h_pull', 'rear_delt', 'biceps'],
    ['hinge_light', 'biceps'],
  ],
  shoulders: [
    ['v_push', 'side_delt'],
    ['rear_delt', 'side_delt'],
    ['abs', 'abs'],
  ],
  arms: [
    ['biceps', 'triceps'],
    ['biceps', 'triceps'],
    ['biceps', 'triceps', 'abs'],
  ],
  chest_back: [
    ['h_push', 'v_pull', 'h_pull'],
    ['incline', 'chest_iso'],
    ['v_pull', 'rear_delt'],
  ],
  shoulders_arms: [
    ['v_push', 'side_delt'],
    ['biceps', 'triceps', 'rear_delt'],
    ['biceps', 'triceps', 'abs'],
  ],
};

const DAY_NAMES: Record<DayType, string> = {
  full: 'Full body',
  upper: 'Haut du corps',
  lower: 'Bas du corps',
  push: 'Push (pecs/épaules/triceps)',
  pull: 'Pull (dos/biceps)',
  legs: 'Jambes',
  chest: 'Pectoraux / triceps',
  back: 'Dos / biceps',
  shoulders: 'Épaules / abdos',
  arms: 'Bras',
  chest_back: 'Pecs / dos',
  shoulders_arms: 'Épaules / bras',
};

/** Répartitions proposées dans le profil : nombre de séances adapté et conseil. */
export const SPLITS: Record<SplitPref, { label: string; hint: string; min: number; max: number }> = {
  auto: { label: 'Automatique', hint: 'La répartition la plus adaptée à ton nombre de séances.', min: 2, max: 6 },
  full: { label: 'Full body', hint: 'Tout le corps à chaque séance. Idéal de 2 à 4 séances par semaine.', min: 2, max: 6 },
  upper_lower: { label: 'Haut / Bas (half body)', hint: 'Une séance haut du corps, une séance bas du corps. Idéal sur 4 séances.', min: 2, max: 6 },
  ppl: { label: 'Push / Pull / Legs', hint: 'Poussée, tirage, jambes. Chaque muscle 2×/semaine à partir de 5–6 séances.', min: 3, max: 6 },
  mix: { label: 'Mix full body + haut/bas', hint: 'Séances haut et bas du corps complétées par du full body. Bien de 3 à 6 séances.', min: 3, max: 6 },
  bro: { label: 'Split par muscle', hint: 'Un ou deux groupes musculaires par séance, plus d’exercices pour chacun.', min: 3, max: 6 },
};

/** Exercices trop fatigants pour des séries longues : toujours en fourchette basse. */
const HEAVY = new Set(['deadlift']);

function autoSplit(days: number): { types: DayType[]; label: string } {
  switch (days) {
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

const alternate = (a: DayType, b: DayType, n: number): DayType[] => Array.from({ length: n }, (_, i) => (i % 2 ? b : a));

/**
 * Répartition des séances. `note` signale un choix moins efficace (muscle travaillé 1×/semaine)
 * ou un choix impossible avec ce nombre de séances (on revient alors à la répartition automatique).
 */
export function splitFor(days: number, pref: SplitPref = 'auto'): { types: DayType[]; label: string; note?: string } {
  const n = Math.max(2, Math.min(6, Math.round(days)));
  const info = SPLITS[pref];
  if (n < info.min) return { ...autoSplit(n), note: `${info.label} demande au moins ${info.min} séances par semaine : répartition automatique utilisée.` };
  const once = 'chaque muscle n’est travaillé qu’une fois par semaine. À volume égal, 2 fois par semaine fait un peu mieux progresser (Schoenfeld 2016).';
  switch (pref) {
    case 'full':
      return { types: Array(n).fill('full'), label: `Full body ×${n}`, note: n >= 5 ? 'Full body sur 5–6 séances : séances plus courtes conseillées pour bien récupérer.' : undefined };
    case 'upper_lower':
      return {
        types: alternate('upper', 'lower', n),
        label: `Haut / Bas ×${n}`,
        note: n === 2 ? `Sur 2 séances, ${once}` : n % 2 ? 'Nombre impair de séances : commence la semaine suivante par la séance suivante du cycle pour équilibrer haut et bas.' : undefined,
      };
    case 'ppl': {
      const t: Record<number, DayType[]> = { 3: ['push', 'pull', 'legs'], 4: ['push', 'pull', 'legs', 'full'], 5: ['push', 'pull', 'legs', 'upper', 'lower'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
      const label = { 3: 'Push / Pull / Legs', 4: 'Push / Pull / Legs + Full body', 5: 'Push / Pull / Legs + Haut / Bas', 6: 'Push / Pull / Legs ×2' }[n]!;
      return { types: t[n], label, note: n === 3 ? `Sur 3 séances, ${once}` : undefined };
    }
    case 'mix': {
      const t: Record<number, DayType[]> = {
        3: ['upper', 'lower', 'full'],
        4: ['upper', 'lower', 'full', 'full'],
        5: ['upper', 'lower', 'full', 'upper', 'lower'],
        6: ['upper', 'lower', 'full', 'upper', 'lower', 'full'],
      };
      return { types: t[n], label: `Haut / Bas + Full body (${n} séances)` };
    }
    case 'bro': {
      const t: Record<number, DayType[]> = {
        3: ['chest_back', 'legs', 'shoulders_arms'],
        4: ['chest', 'back', 'legs', 'shoulders_arms'],
        5: ['chest', 'back', 'legs', 'shoulders', 'arms'],
        6: ['chest', 'back', 'legs', 'shoulders', 'arms', 'legs'],
      };
      return { types: t[n], label: `Split par muscle (${n} séances)`, note: n === 6 ? 'Jambes 2×/semaine ; pour le haut du corps, ' + once : `Avec ce split, ${once}` };
    }
    default:
      return autoSplit(n);
  }
}

function pick(pattern: Pattern, equipment: Equipment, variant: number, used: Set<string>, machines = false): string | undefined {
  if (machines && equipment === 'full_gym') {
    const m = (MACHINE_ALT[pattern] ?? []).filter((id) => getExercise(id).equipment.includes(equipment) && !used.has(id));
    if (m.length) return m[variant % m.length];
  }
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

/** Plafond hebdomadaire : haut de la zone optimale (MAV), un peu plus pour les priorités. */
function weeklyCap(profile: Profile, m: Muscle): number {
  const lm = VOLUME_LANDMARKS[m];
  return profile.priorities.includes(m) ? Math.min(lm.mavHigh + 2, lm.mrv - 1) : lm.mavHigh;
}

function scheme(profile: Profile, exerciseId: string, primaryLift: boolean): Pick<PlannedExercise, 'repMin' | 'repMax' | 'rir' | 'restSec'> {
  const ex = getExercise(exerciseId);
  const lvlRir = profile.level === 'beginner' ? 2 : profile.level === 'advanced' ? 0 : 1;
  // Séries lourdes : mouvement de base polyarticulaire. Machines guidées et isolation restent en 8–15.
  const heavy = (primaryLift && ex.kind === 'compound' && ex.increment > 0 && !ex.machine) || HEAVY.has(exerciseId);
  if (profile.goal === 'strength' && heavy) return { repMin: 3, repMax: 5, rir: 2, restSec: 210 };
  if (heavy) return { repMin: 5, repMax: 8, rir: Math.max(1, lvlRir), restSec: 180 };
  if (ex.kind === 'compound') return { repMin: 8, repMax: 12, rir: lvlRir, restSec: 120 };
  return { repMin: 10, repMax: 15, rir: Math.max(0, lvlRir - 1), restSec: 75 };
}

const total = (d: ProgramDay) => d.exercises.reduce((s, e) => s + e.sets, 0);

/**
 * Génère un programme personnalisé à partir du profil :
 * - répartition choisie dans le profil, ou selon le nombre de séances (fréquence 2×/muscle, Schoenfeld 2016),
 * - machines guidées en priorité si demandé,
 * - exercices filtrés selon le matériel disponible,
 * - volume ajusté au niveau et aux muscles prioritaires, plafonné à la zone optimale (MAV),
 * - nombre de séries limité par la durée de séance (~3,5 min par série, repos compris).
 */
export function generateProgram(profile: Profile): Program {
  const { types, label, note } = splitFor(profile.daysPerWeek, profile.split);
  const machines = profile.preferMachines === true && profile.equipment === 'full_gym';
  // Séances courtes (≤ 30 min) : moins de séries par exercice, repos raccourcis et supersets
  // (Iversen et al. 2021) – environ 2,5 min par série au lieu de 3,5.
  const short = profile.sessionMinutes <= 30;
  const maxSets = short ? Math.floor(profile.sessionMinutes / 2.5) : Math.max(8, Math.floor(profile.sessionMinutes / 3.5));
  const seen: Partial<Record<DayType, number>> = {};
  const mainSets = short ? 2 : profile.level === 'advanced' ? 4 : 3;

  const days: ProgramDay[] = types.map((type) => {
    const variant = seen[type] ?? 0;
    seen[type] = variant + 1;
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    let sets = 0;
    const hitsPriority = (id: string) => getExercise(id).primary.some((m) => profile.priorities.includes(m));
    DAY_TEMPLATES[type].forEach((tier, t) => {
      // Dans un palier, les exercices des muscles prioritaires passent en premier.
      const ordered = t === 0 ? tier : [...tier].sort((a, b) => Number(hitsPriority(PATTERNS[b][0])) - Number(hitsPriority(PATTERNS[a][0])));
      for (const pattern of ordered) {
        const id = pick(pattern, profile.equipment, variant, used, machines);
        if (!id) continue;
        // Les 2 mouvements principaux ont le plus de séries ; l'équilibrage complète ensuite.
        const n = t === 0 ? (exercises.length < 2 ? mainSets : mainSets - 1) : 2;
        // Le palier de base passe toujours ; les autres selon le temps restant (+2 séries tolérées pour une priorité).
        if (t > 0 && sets + n > maxSets + (hitsPriority(id) ? 2 : 0)) continue;
        used.add(id);
        sets += n;
        exercises.push({ exerciseId: id, sets: n, ...scheme(profile, id, exercises.length === 0) });
      }
    });
    const sameName = types.filter((x) => x === type).length > 1;
    return { name: `${DAY_NAMES[type]}${sameName ? ` ${String.fromCharCode(65 + variant)}` : ''}`, exercises };
  });

  boostPriorities(profile, days, maxSets);
  balanceVolume(profile, days, maxSets);
  trimVolume(profile, days);
  if (short) for (const d of days) for (const e of d.exercises) e.restSec = Math.min(e.restSec, 90);

  return {
    id: `custom_${Date.now()}`,
    name: `Mon programme – ${label}`,
    author: 'Généré à partir de ton profil',
    description: `${GOAL_LABELS[profile.goal]}, ${profile.daysPerWeek} séances de ~${profile.sessionMinutes} min. ${
      profile.priorities.length ? `Priorités : ${profile.priorities.map((m) => MUSCLE_LABELS[m]).join(', ')}.` : ''
    }${machines ? ' Machines guidées en priorité.' : ''}${note ? ` ${note}` : ''}${short ? ' Séances courtes : enchaîne les exercices deux par deux (superset haut/bas ou poussée/tirage) et limite les repos à 60–90 s.' : ''}`,
    level: [profile.level],
    goals: [profile.goal],
    daysPerWeek: types.length,
    progression:
      profile.goal === 'cut'
        ? 'En sèche, l’objectif est de maintenir les charges : garde l’intensité (proche de l’échec) et réduis le volume de 1/3 si la récupération baisse.'
        : 'Double progression : quand la 1re série atteint le haut de la fourchette et les autres en sont à 1 rep, ajoute la charge minimale. Décharge (volume ÷ 2) toutes les 5–6 semaines.',
    days,
    custom: true,
    generated: true,
  };
}

/** Exercice à renforcer pour un muscle : l'isolation d'abord (moins de fatigue systémique). */
function findFor(day: ProgramDay, m: Muscle): PlannedExercise | undefined {
  const candidates = day.exercises.filter((e) => getExercise(e.exerciseId).primary.includes(m) && e.sets < 5);
  return candidates.find((e) => getExercise(e.exerciseId).kind === 'isolation') ?? candidates.at(-1);
}

/** Muscles prioritaires : jusqu'à +4 séries hebdomadaires, réparties sur les séances. */
function boostPriorities(profile: Profile, days: ProgramDay[], maxSets: number) {
  for (const m of profile.priorities) {
    let added = 0;
    for (let round = 0; round < 2 && added < 4; round++) {
      for (const day of days) {
        if (added >= 4) break;
        const ex = findFor(day, m);
        if (ex && total(day) < maxSets) {
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
    for (const m of MUSCLES) {
      if (m === 'abs' || m === 'glutes') continue;
      if (vol[m] >= weeklySetTarget(profile, m)) continue;
      for (const day of days) {
        const ex = total(day) < maxSets ? findFor(day, m) : undefined;
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

/** Retire des séries aux muscles au-delà de leur plafond (en partant des derniers exercices). */
function trimVolume(profile: Profile, days: ProgramDay[]) {
  for (let pass = 0; pass < 40; pass++) {
    const vol = volumeFromSets(days.flatMap((d) => d.exercises));
    const over = MUSCLES.filter((m) => m !== 'abs').find((m) => vol[m] > weeklyCap(profile, m));
    if (!over) return;
    // Fessiers : sollicités par tous les mouvements de jambes, on ne réduit que leurs exercices dédiés.
    const dedicated = (id: string) => getExercise(id).primary.every((m) => m === over);
    const victim = days
      .flatMap((d) => d.exercises)
      .filter((e) => getExercise(e.exerciseId).primary.includes(over) && (over === 'glutes' ? dedicated(e.exerciseId) : e.sets > 2))
      .sort((a, b) => b.sets - a.sets || Number(getExercise(b.exerciseId).kind === 'isolation') - Number(getExercise(a.exerciseId).kind === 'isolation'))[0];
    if (!victim) return;
    victim.sets -= 1;
    if (victim.sets === 0) for (const d of days) d.exercises = d.exercises.filter((e) => e !== victim);
  }
}
