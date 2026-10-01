import type { PlannedExercise, Program } from '../lib/types';

const ex = (exerciseId: string, sets: number, repMin: number, repMax = repMin, rir = 2, restSec = 120, note?: string): PlannedExercise => ({
  exerciseId,
  sets,
  repMin,
  repMax,
  rir,
  restSec,
  note,
});

/**
 * Programmes de référence, inspirés de méthodes publiques reconnues.
 * Ce sont des adaptations simplifiées : les auteurs cités sont la source d'inspiration,
 * pas les éditeurs de ces versions.
 */
export const PROGRAMS: Program[] = [
  {
    id: 'linear_5x5',
    name: 'Force linéaire 5×5 (A/B)',
    author: 'Inspiré de StrongLifts 5×5 (M. Mehdi) et Starting Strength (M. Rippetoe)',
    description:
      'Programme débutant en full body, 3 séances par semaine en alternant A et B. On ajoute du poids à chaque séance réussie. Idéal pour les 3 à 6 premiers mois.',
    level: ['beginner'],
    goals: ['strength', 'recomp', 'bulk'],
    daysPerWeek: 3,
    progression: '+2,5 kg par séance sur les exercices du haut, +5 kg sur le soulevé de terre si toutes les séries sont réussies. Après 3 échecs consécutifs : -10 %.',
    days: [
      { name: 'Séance A', exercises: [ex('squat', 5, 5, 5, 1, 180), ex('bench', 5, 5, 5, 1, 180), ex('barbell_row', 5, 5, 5, 1, 150)] },
      { name: 'Séance B', exercises: [ex('squat', 5, 5, 5, 1, 180), ex('ohp', 5, 5, 5, 1, 180), ex('deadlift', 1, 5, 5, 1, 240)] },
    ],
  },
  {
    id: 'gzclp',
    name: 'GZCLP (T1/T2/T3)',
    author: 'Inspiré de la méthode GZCL (Cody Lefever)',
    description:
      'Structure en 3 niveaux : T1 lourd (force), T2 modéré (volume), T3 léger (hypertrophie, dernier set à l’échec). Très bon pont entre force et esthétique.',
    level: ['beginner', 'intermediate'],
    goals: ['strength', 'recomp', 'bulk'],
    daysPerWeek: 4,
    progression: 'T1 : 5×3 puis 6×2 puis 10×1 en cas d’échec. T2 : 3×10 → 3×8 → 3×6. T3 : augmenter quand le dernier set dépasse 25 répétitions.',
    days: [
      { name: 'J1 – Squat / Bench', exercises: [ex('squat', 5, 3, 3, 1, 180, 'T1'), ex('bench', 3, 10, 10, 2, 120, 'T2'), ex('lat_pulldown', 3, 15, 25, 0, 90, 'T3')] },
      { name: 'J2 – OHP / Deadlift', exercises: [ex('ohp', 5, 3, 3, 1, 180, 'T1'), ex('deadlift', 3, 10, 10, 2, 150, 'T2'), ex('db_row', 3, 15, 25, 0, 90, 'T3')] },
      { name: 'J3 – Bench / Squat', exercises: [ex('bench', 5, 3, 3, 1, 180, 'T1'), ex('squat', 3, 10, 10, 2, 150, 'T2'), ex('lat_pulldown', 3, 15, 25, 0, 90, 'T3')] },
      { name: 'J4 – Deadlift / OHP', exercises: [ex('deadlift', 5, 3, 3, 1, 180, 'T1'), ex('ohp', 3, 10, 10, 2, 120, 'T2'), ex('db_row', 3, 15, 25, 0, 90, 'T3')] },
    ],
  },
  {
    id: 'wendler_531_bbb',
    name: '5/3/1 Boring But Big',
    author: 'Inspiré de Jim Wendler',
    description:
      'Cycle de 4 semaines basé sur un “Training Max” à 90 % du 1RM. Une série principale (5/3/1) puis 5×10 à 50–60 % pour le volume. Progression lente mais durable.',
    level: ['intermediate', 'advanced'],
    goals: ['strength', 'bulk'],
    daysPerWeek: 4,
    progression: 'Semaine 1 : 65/75/85 % × 5. Semaine 2 : 70/80/90 % × 3. Semaine 3 : 75/85/95 % × 5/3/1+. Semaine 4 : décharge. +2,5 kg (haut) / +5 kg (bas) au TM par cycle.',
    days: [
      { name: 'Développé militaire', exercises: [ex('ohp', 3, 5, 5, 1, 180, '5/3/1'), ex('ohp', 5, 10, 10, 3, 90, 'BBB 50–60 % TM'), ex('chinup', 5, 8, 10, 2, 90)] },
      { name: 'Soulevé de terre', exercises: [ex('deadlift', 3, 5, 5, 1, 240, '5/3/1'), ex('deadlift', 5, 10, 10, 3, 120, 'BBB 50–60 % TM'), ex('hanging_leg_raise', 5, 10, 15, 2, 60)] },
      { name: 'Développé couché', exercises: [ex('bench', 3, 5, 5, 1, 180, '5/3/1'), ex('bench', 5, 10, 10, 3, 90, 'BBB 50–60 % TM'), ex('db_row', 5, 10, 10, 2, 90)] },
      { name: 'Squat', exercises: [ex('squat', 3, 5, 5, 1, 240, '5/3/1'), ex('squat', 5, 10, 10, 3, 120, 'BBB 50–60 % TM'), ex('leg_curl', 5, 10, 12, 2, 60)] },
    ],
  },
  {
    id: 'phul',
    name: 'PHUL – Power Hypertrophy Upper Lower',
    author: 'Inspiré de Brandon Campbell',
    description: '4 séances : 2 jours “force” (haut / bas) et 2 jours “hypertrophie”. Bon compromis pour gagner en force et en volume musculaire.',
    level: ['intermediate'],
    goals: ['bulk', 'recomp', 'strength'],
    daysPerWeek: 4,
    progression: 'Double progression : quand toutes les séries atteignent le haut de la fourchette, augmenter la charge.',
    days: [
      { name: 'Haut – Force', exercises: [ex('bench', 4, 3, 5, 1, 180), ex('incline_db', 3, 6, 10, 2, 120), ex('barbell_row', 4, 3, 5, 1, 180), ex('lat_pulldown', 3, 6, 10, 2, 120), ex('ohp', 3, 5, 8, 2, 120), ex('barbell_curl', 3, 6, 10, 2, 90), ex('overhead_ext', 3, 6, 10, 2, 90)] },
      { name: 'Bas – Force', exercises: [ex('squat', 4, 3, 5, 1, 180), ex('deadlift', 3, 3, 5, 1, 240), ex('leg_press', 4, 10, 15, 2, 120), ex('leg_curl', 4, 6, 10, 2, 90), ex('calf_raise', 4, 6, 10, 1, 60)] },
      { name: 'Haut – Hypertrophie', exercises: [ex('incline_db', 4, 8, 12, 1, 90), ex('cable_fly', 3, 8, 12, 1, 60), ex('cable_row', 4, 8, 12, 1, 90), ex('db_row', 3, 8, 12, 1, 90), ex('lateral_raise', 3, 10, 15, 1, 60), ex('db_curl', 3, 8, 12, 1, 60), ex('triceps_pushdown', 3, 8, 12, 1, 60)] },
      { name: 'Bas – Hypertrophie', exercises: [ex('front_squat', 3, 8, 12, 2, 120), ex('bulgarian_split', 3, 8, 12, 1, 90), ex('leg_ext', 3, 10, 15, 1, 60), ex('leg_curl', 3, 10, 15, 1, 60), ex('hip_thrust', 3, 8, 12, 1, 90), ex('calf_raise', 4, 10, 15, 1, 60)] },
    ],
  },
  {
    id: 'ppl6',
    name: 'Push / Pull / Legs ×2',
    author: 'Inspiré du PPL de r/Fitness (Metallicadpa)',
    description: '6 séances par semaine, chaque muscle travaillé 2 fois. Un exercice principal lourd puis du volume en accessoires. Pour pratiquants réguliers et récupération solide.',
    level: ['intermediate', 'advanced'],
    goals: ['bulk', 'recomp'],
    daysPerWeek: 6,
    progression: 'Exercice principal : 4×5 + dernier set en AMRAP, +2,5 kg par séance. Accessoires : double progression 8–12.',
    days: [
      { name: 'Push', exercises: [ex('bench', 5, 5, 5, 1, 180, 'Dernière série AMRAP'), ex('ohp', 3, 8, 12, 2, 120), ex('incline_db', 3, 8, 12, 1, 90), ex('triceps_pushdown', 3, 8, 12, 1, 60), ex('lateral_raise', 3, 15, 20, 1, 60), ex('overhead_ext', 3, 8, 12, 1, 60)] },
      { name: 'Pull', exercises: [ex('deadlift', 1, 5, 5, 1, 240, 'AMRAP'), ex('lat_pulldown', 3, 8, 12, 1, 90), ex('cable_row', 3, 8, 12, 1, 90), ex('face_pull', 5, 15, 20, 1, 60), ex('hammer_curl', 4, 8, 12, 1, 60), ex('db_curl', 4, 8, 12, 1, 60)] },
      { name: 'Legs', exercises: [ex('squat', 3, 5, 5, 1, 180, 'Dernière série AMRAP'), ex('rdl', 3, 8, 12, 2, 120), ex('leg_press', 3, 8, 12, 1, 120), ex('leg_curl', 3, 8, 12, 1, 60), ex('calf_raise', 5, 8, 12, 1, 60)] },
      { name: 'Push 2', exercises: [ex('ohp', 5, 5, 5, 1, 180, 'Dernière série AMRAP'), ex('bench', 3, 8, 12, 2, 120), ex('incline_db', 3, 8, 12, 1, 90), ex('triceps_pushdown', 3, 8, 12, 1, 60), ex('lateral_raise', 3, 15, 20, 1, 60)] },
      { name: 'Pull 2', exercises: [ex('barbell_row', 5, 5, 5, 1, 150, 'Dernière série AMRAP'), ex('pullup', 3, 8, 12, 1, 120), ex('cable_row', 3, 8, 12, 1, 90), ex('face_pull', 5, 15, 20, 1, 60), ex('barbell_curl', 4, 8, 12, 1, 60)] },
      { name: 'Legs 2', exercises: [ex('squat', 3, 8, 12, 2, 150), ex('rdl', 3, 8, 12, 2, 120), ex('bulgarian_split', 3, 8, 12, 1, 90), ex('leg_ext', 3, 10, 15, 1, 60), ex('calf_raise', 5, 8, 12, 1, 60)] },
    ],
  },
  {
    id: 'upper_lower_hypertrophy',
    name: 'Upper / Lower hypertrophie (science-based)',
    author: 'Inspiré des principes de Jeff Nippard, Mike Israetel (RP) et Brad Schoenfeld',
    description:
      '4 séances, fréquence 2× par muscle, 10–20 séries hebdomadaires par muscle, séries proches de l’échec (1–2 RIR) et mise en tension en position étirée.',
    level: ['beginner', 'intermediate', 'advanced'],
    goals: ['bulk', 'recomp', 'cut'],
    daysPerWeek: 4,
    progression: 'Double progression + RIR : commencer à 3 RIR en semaine 1, finir à 0–1 RIR en semaine 5, puis 1 semaine de décharge (volume ÷ 2).',
    days: [
      { name: 'Upper A', exercises: [ex('bench', 3, 6, 8, 2, 150), ex('cable_row', 3, 8, 10, 1, 120), ex('incline_db', 2, 8, 12, 1, 90), ex('lat_pulldown', 2, 10, 12, 1, 90), ex('lateral_raise', 3, 12, 15, 0, 60), ex('db_curl', 2, 10, 12, 1, 60), ex('overhead_ext', 2, 10, 12, 1, 60)] },
      { name: 'Lower A', exercises: [ex('squat', 3, 6, 8, 2, 180), ex('rdl', 3, 8, 10, 2, 150), ex('leg_ext', 2, 10, 15, 0, 60), ex('leg_curl', 2, 10, 15, 0, 60), ex('calf_raise', 3, 10, 15, 0, 60), ex('cable_crunch', 3, 10, 15, 1, 60)] },
      { name: 'Upper B', exercises: [ex('ohp', 3, 6, 8, 2, 150), ex('pullup', 3, 6, 10, 1, 120), ex('db_bench', 2, 8, 12, 1, 90), ex('db_row', 2, 8, 12, 1, 90), ex('cable_fly', 2, 12, 15, 0, 60), ex('face_pull', 2, 12, 15, 1, 60), ex('hammer_curl', 2, 10, 12, 1, 60), ex('triceps_pushdown', 2, 10, 12, 1, 60)] },
      { name: 'Lower B', exercises: [ex('deadlift', 3, 4, 6, 2, 210), ex('leg_press', 3, 10, 12, 1, 120), ex('bulgarian_split', 2, 8, 12, 1, 90), ex('leg_curl', 3, 10, 12, 0, 60), ex('calf_raise', 3, 10, 15, 0, 60), ex('hanging_leg_raise', 3, 10, 15, 1, 60)] },
    ],
  },
  {
    id: 'fullbody_home',
    name: 'Full body maison (haltères)',
    author: 'Inspiré des routines haltères de Jeff Cavaliere (Athlean-X) et Mike Israetel',
    description: '3 séances full body avec une paire d’haltères réglables et un banc. Progression par répétitions puis par charge.',
    level: ['beginner', 'intermediate'],
    goals: ['cut', 'recomp', 'bulk'],
    daysPerWeek: 3,
    progression: 'Double progression 8–15 : atteindre 15 reps sur toutes les séries puis augmenter la charge ou ralentir le tempo (3 s en descente).',
    days: [
      { name: 'Full body A', exercises: [ex('goblet_squat', 3, 10, 15, 1, 90), ex('db_bench', 3, 8, 12, 1, 90), ex('db_row', 3, 8, 12, 1, 90), ex('lateral_raise', 3, 12, 20, 0, 60), ex('db_curl', 2, 10, 15, 0, 60)] },
      { name: 'Full body B', exercises: [ex('rdl', 3, 8, 12, 2, 120), ex('db_ohp', 3, 8, 12, 1, 90), ex('pushup', 3, 10, 20, 1, 60), ex('bulgarian_split', 3, 8, 12, 1, 90), ex('overhead_ext', 2, 10, 15, 0, 60)] },
      { name: 'Full body C', exercises: [ex('bulgarian_split', 3, 10, 12, 1, 90), ex('incline_db', 3, 8, 12, 1, 90), ex('db_row', 3, 10, 12, 1, 90), ex('hip_thrust', 3, 10, 15, 1, 90), ex('hammer_curl', 2, 10, 15, 0, 60), ex('plank', 3, 30, 60, 1, 60)] },
    ],
  },
];
