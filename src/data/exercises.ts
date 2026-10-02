import type { Exercise, Muscle } from '../lib/types';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quadriceps',
  hamstrings: 'Ischios',
  glutes: 'Fessiers',
  calves: 'Mollets',
  abs: 'Abdos',
};

export const MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

const G = 'full_gym' as const;
const D = 'home_dumbbells' as const;
const B = 'bodyweight' as const;

export const EXERCISES: Exercise[] = [
  // Jambes
  { id: 'squat', name: 'Squat barre', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'abs'], equipment: [G], kind: 'compound', increment: 2.5, tips: 'Gainage avant la descente, genoux dans l’axe des pieds, descendre au moins à la parallèle.' },
  { id: 'front_squat', name: 'Front squat', primary: ['quads'], secondary: ['glutes', 'abs'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'deadlift', name: 'Soulevé de terre', primary: ['hamstrings', 'glutes', 'back'], secondary: ['quads', 'abs'], equipment: [G], kind: 'compound', increment: 5, tips: 'Barre au contact des tibias, dos neutre, pousser le sol avec les jambes.' },
  { id: 'rdl', name: 'Soulevé de terre roumain', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: [G, D], kind: 'compound', increment: 2.5, tips: 'Hanches vers l’arrière, légère flexion des genoux, sentir l’étirement des ischios.' },
  { id: 'leg_press', name: 'Presse à cuisses', primary: ['quads', 'glutes'], secondary: [], equipment: [G], kind: 'compound', increment: 5 },
  { id: 'hack_squat', name: 'Hack squat', primary: ['quads'], secondary: ['glutes'], equipment: [G], kind: 'compound', increment: 5 },
  { id: 'bulgarian_split', name: 'Fente bulgare', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'compound', increment: 2 },
  { id: 'goblet_squat', name: 'Goblet squat', primary: ['quads', 'glutes'], secondary: ['abs'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'leg_ext', name: 'Leg extension', primary: ['quads'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'leg_curl', name: 'Leg curl assis', primary: ['hamstrings'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'nordic', name: 'Nordic curl', primary: ['hamstrings'], secondary: [], equipment: [B], kind: 'isolation', increment: 0 },
  { id: 'hip_thrust', name: 'Hip thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'compound', increment: 5 },
  { id: 'calf_raise', name: 'Mollets debout', primary: ['calves'], secondary: [], equipment: [G, D, B], kind: 'isolation', increment: 2.5 },
  { id: 'seated_calf', name: 'Mollets assis', primary: ['calves'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 2.5 },
  { id: 'glute_bridge', name: 'Pont fessier', primary: ['glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'isolation', increment: 2.5 },
  { id: 'step_up', name: 'Montée sur banc', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'compound', increment: 2 },
  { id: 'sl_rdl', name: 'Soulevé de terre roumain une jambe', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: [G, D, B], kind: 'compound', increment: 2 },
  { id: 'back_extension', name: 'Extension lombaire (banc à 45°)', primary: ['glutes', 'hamstrings'], secondary: ['back'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'power_clean', name: 'Épaulé en puissance', primary: ['glutes', 'hamstrings', 'back'], secondary: ['quads', 'shoulders'], equipment: [G], kind: 'compound', increment: 2.5, tips: 'Barre près du corps, extension complète des hanches avant de tirer avec les bras ; réception en quart de squat.' },
  { id: 'bw_squat', name: 'Squat au poids du corps', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [B, D, G], kind: 'compound', increment: 0 },
  { id: 'lunge', name: 'Fentes', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [B, D, G], kind: 'compound', increment: 2 },
  { id: 'wall_sit', name: 'Chaise contre le mur (secondes)', primary: ['quads'], secondary: ['glutes'], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'jumping_jacks', name: 'Jumping jacks (secondes)', primary: ['calves'], secondary: ['shoulders', 'quads'], equipment: [B, D, G], kind: 'compound', increment: 0 },
  { id: 'high_knees', name: 'Montées de genoux sur place (secondes)', primary: ['quads'], secondary: ['abs', 'calves'], equipment: [B, D, G], kind: 'compound', increment: 0 },
  { id: 'kb_swing', name: 'Swing kettlebell (ou haltère)', primary: ['glutes', 'hamstrings'], secondary: ['back', 'abs'], equipment: [G, D], kind: 'compound', increment: 4, tips: 'Charnière de hanche, pas un squat : les hanches projettent la kettlebell, les bras ne font que la guider.' },
  { id: 'kb_clean', name: 'Épaulé kettlebell', primary: ['glutes', 'hamstrings', 'back'], secondary: ['shoulders'], equipment: [G, D], kind: 'compound', increment: 4 },
  { id: 'turkish_getup', name: 'Turkish get-up', primary: ['shoulders', 'abs'], secondary: ['glutes', 'quads'], equipment: [G, D], kind: 'compound', increment: 4, tips: 'Lentement, le regard sur la charge, bras tendu à la verticale du début à la fin.' },
  { id: 'pistol_squat', name: 'Squat une jambe (assisté)', primary: ['quads', 'glutes'], secondary: [], equipment: [B], kind: 'compound', increment: 0 },

  // Poussée
  { id: 'bench', name: 'Développé couché', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: [G], kind: 'compound', increment: 2.5, tips: 'Omoplates serrées, pieds ancrés, barre au niveau du bas des pectoraux.' },
  { id: 'incline_db', name: 'Développé incliné haltères', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'incline_bench', name: 'Développé incliné barre', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'close_grip_bench', name: 'Développé couché prise serrée', primary: ['triceps', 'chest'], secondary: ['shoulders'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'db_bench', name: 'Développé couché haltères', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'dips', bodyweight: true, name: 'Dips', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: [G, B], kind: 'compound', increment: 2.5 },
  { id: 'pushup_rotation', name: 'Pompes avec rotation', primary: ['chest'], secondary: ['shoulders', 'abs', 'triceps'], equipment: [B, D, G], kind: 'compound', increment: 0 },
  { id: 'bench_dip', name: 'Dips sur chaise / banc', primary: ['triceps'], secondary: ['chest', 'shoulders'], equipment: [B, D, G], kind: 'compound', increment: 0 },
  { id: 'pushup', name: 'Pompes', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: [B, D], kind: 'compound', increment: 0 },
  { id: 'pec_deck', name: 'Pec deck (butterfly)', primary: ['chest'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'cable_fly', name: 'Écarté poulie', primary: ['chest'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'db_fly', name: 'Écarté haltères', primary: ['chest'], secondary: [], equipment: [D], kind: 'isolation', increment: 1 },
  { id: 'ohp', name: 'Développé militaire', primary: ['shoulders'], secondary: ['triceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'db_ohp', name: 'Développé épaules haltères', primary: ['shoulders'], secondary: ['triceps'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'pike_pushup', name: 'Pompes piquées', primary: ['shoulders'], secondary: ['triceps'], equipment: [B], kind: 'compound', increment: 0 },
  { id: 'lateral_raise', name: 'Élévations latérales', primary: ['shoulders'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'triceps_pushdown', name: 'Extension triceps poulie', primary: ['triceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'overhead_ext', name: 'Extension triceps au-dessus de la tête', primary: ['triceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'skull_crusher', name: 'Barre au front', primary: ['triceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'diamond_pushup', name: 'Pompes diamant', primary: ['triceps'], secondary: ['chest'], equipment: [B], kind: 'compound', increment: 0 },

  // Tirage
  { id: 'pullup', bodyweight: true, name: 'Tractions', primary: ['back'], secondary: ['biceps'], equipment: [G, B], kind: 'compound', increment: 2.5 },
  { id: 'lat_pulldown', name: 'Tirage vertical', primary: ['back'], secondary: ['biceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'barbell_row', name: 'Rowing barre', primary: ['back'], secondary: ['biceps', 'hamstrings'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'db_row', name: 'Rowing haltère unilatéral', primary: ['back'], secondary: ['biceps'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'cable_row', name: 'Tirage horizontal poulie', primary: ['back'], secondary: ['biceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'inverted_row', name: 'Rowing inversé', primary: ['back'], secondary: ['biceps'], equipment: [B], kind: 'compound', increment: 0 },
  { id: 'face_pull', name: 'Face pull', primary: ['shoulders'], secondary: ['back'], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'rear_delt_fly', name: 'Oiseau haltères', primary: ['shoulders'], secondary: ['back'], equipment: [D, G], kind: 'isolation', increment: 1 },
  { id: 'barbell_curl', name: 'Curl barre', primary: ['biceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'db_curl', name: 'Curl haltères incliné', primary: ['biceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'preacher_curl', name: 'Curl pupitre', primary: ['biceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 1 },
  { id: 'hammer_curl', name: 'Curl marteau', primary: ['biceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'chinup', bodyweight: true, name: 'Tractions supination', primary: ['back', 'biceps'], secondary: [], equipment: [G, B], kind: 'compound', increment: 2.5 },

  // Gainage
  { id: 'cable_crunch', name: 'Crunch poulie', primary: ['abs'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'hanging_leg_raise', name: 'Relevé de jambes suspendu', primary: ['abs'], secondary: [], equipment: [G, B], kind: 'isolation', increment: 0 },
  { id: 'crunch', name: 'Crunch / relevé de buste', primary: ['abs'], secondary: [], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'side_plank', name: 'Gainage latéral (secondes)', primary: ['abs'], secondary: [], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'superman', name: 'Superman / arch hold (secondes)', primary: ['back'], secondary: ['glutes'], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'plank', name: 'Gainage (secondes)', primary: ['abs'], secondary: [], equipment: [B, D, G], kind: 'isolation', increment: 0 },
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  return byId.get(id) ?? { id, name: id, primary: [], secondary: [], equipment: [], kind: 'isolation', increment: 2.5 };
}
