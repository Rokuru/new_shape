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
  { id: 'leg_press', machine: true, name: 'Presse à cuisses (Leg press)', primary: ['quads', 'glutes'], secondary: [], equipment: [G], kind: 'compound', increment: 5 },
  { id: 'hack_squat', machine: true, name: 'Hack squat', primary: ['quads'], secondary: ['glutes'], equipment: [G], kind: 'compound', increment: 5 },
  { id: 'bulgarian_split', name: 'Fente bulgare', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'compound', increment: 2 },
  { id: 'goblet_squat', name: 'Goblet squat', primary: ['quads', 'glutes'], secondary: ['abs'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'leg_ext', machine: true, name: 'Extension des jambes (Leg extension)', primary: ['quads'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'leg_curl', machine: true, name: 'Curl jambes assis (Seated leg curl)', primary: ['hamstrings'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'nordic', name: 'Nordic curl', primary: ['hamstrings'], secondary: [], equipment: [B], kind: 'isolation', increment: 0 },
  { id: 'hip_thrust', name: 'Hip thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'compound', increment: 5 },
  { id: 'calf_raise', name: 'Mollets debout', primary: ['calves'], secondary: [], equipment: [G, D, B], kind: 'isolation', increment: 2.5 },
  { id: 'seated_calf', name: 'Mollets assis (Seated calf)', primary: ['calves'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 2.5 },
  { id: 'glute_bridge', name: 'Pont fessier', primary: ['glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'isolation', increment: 2.5 },
  { id: 'step_up', name: 'Montée sur banc', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [G, D, B], kind: 'compound', increment: 2 },
  { id: 'sl_rdl', name: 'Soulevé de terre roumain une jambe', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: [G, D, B], kind: 'compound', increment: 2 },
  { id: 'back_extension', name: 'Extension lombaire banc 45° (Hyperextension)', primary: ['glutes', 'hamstrings'], secondary: ['back'], equipment: [G], kind: 'compound', increment: 2.5 },
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
  { id: 'pec_deck', machine: true, name: 'Butterfly (Pec fly)', primary: ['chest'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'cable_fly', name: 'Écarté poulie (Cable crossover)', primary: ['chest'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'db_fly', name: 'Écarté haltères', primary: ['chest'], secondary: [], equipment: [D], kind: 'isolation', increment: 1 },
  { id: 'ohp', name: 'Développé militaire', primary: ['shoulders'], secondary: ['triceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'db_ohp', name: 'Développé épaules haltères', primary: ['shoulders'], secondary: ['triceps'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'pike_pushup', name: 'Pompes piquées', primary: ['shoulders'], secondary: ['triceps'], equipment: [B], kind: 'compound', increment: 0 },
  { id: 'lateral_raise', name: 'Élévations latérales', primary: ['shoulders'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'triceps_pushdown', name: 'Extension triceps poulie (Triceps pushdown)', primary: ['triceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'overhead_ext', name: 'Extension triceps au-dessus de la tête', primary: ['triceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'skull_crusher', name: 'Barre au front', primary: ['triceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'diamond_pushup', name: 'Pompes diamant', primary: ['triceps'], secondary: ['chest'], equipment: [B], kind: 'compound', increment: 0 },

  // Tirage
  { id: 'pullup', bodyweight: true, name: 'Tractions', primary: ['back'], secondary: ['biceps'], equipment: [G, B], kind: 'compound', increment: 2.5 },
  { id: 'lat_pulldown', machine: true, name: 'Tirage vertical (Lat pulldown)', primary: ['back'], secondary: ['biceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'barbell_row', name: 'Rowing barre', primary: ['back'], secondary: ['biceps', 'hamstrings'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'db_row', name: 'Rowing haltère unilatéral', primary: ['back'], secondary: ['biceps'], equipment: [G, D], kind: 'compound', increment: 2 },
  { id: 'cable_row', name: 'Tirage horizontal poulie (Seated cable row)', primary: ['back'], secondary: ['biceps'], equipment: [G], kind: 'compound', increment: 2.5 },
  { id: 'inverted_row', name: 'Rowing inversé', primary: ['back'], secondary: ['biceps'], equipment: [B], kind: 'compound', increment: 0 },
  { id: 'face_pull', name: 'Face pull', primary: ['shoulders'], secondary: ['back'], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'rear_delt_fly', name: 'Oiseau haltères', primary: ['shoulders'], secondary: ['back'], equipment: [D, G], kind: 'isolation', increment: 1 },
  { id: 'barbell_curl', name: 'Curl barre', primary: ['biceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'db_curl', name: 'Curl haltères incliné', primary: ['biceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'preacher_curl', name: 'Curl pupitre', primary: ['biceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 1 },
  { id: 'hammer_curl', name: 'Curl marteau', primary: ['biceps'], secondary: [], equipment: [G, D], kind: 'isolation', increment: 1 },
  { id: 'chinup', bodyweight: true, name: 'Tractions supination', primary: ['back', 'biceps'], secondary: [], equipment: [G, B], kind: 'compound', increment: 2.5 },

  // Gainage
  { id: 'cable_crunch', name: 'Crunch poulie (Cable crunch)', primary: ['abs'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5 },
  { id: 'hanging_leg_raise', name: 'Relevé de jambes suspendu', primary: ['abs'], secondary: [], equipment: [G, B], kind: 'isolation', increment: 0 },
  { id: 'crunch', name: 'Crunch / relevé de buste', primary: ['abs'], secondary: [], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'side_plank', name: 'Gainage latéral (secondes)', primary: ['abs'], secondary: [], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'superman', name: 'Superman / arch hold (secondes)', primary: ['back'], secondary: ['glutes'], equipment: [B, D, G], kind: 'isolation', increment: 0 },
  { id: 'plank', name: 'Gainage (secondes)', primary: ['abs'], secondary: [], equipment: [B, D, G], kind: 'isolation', increment: 0 },

  // Machines guidées des clubs Basic-Fit (Matrix, Technogym selon les clubs) : nom français (nom anglais inscrit sur la machine).
  { id: 'm_chest_press', machine: true, name: 'Presse pectoraux (Chest press)', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: [G], kind: 'compound', increment: 5, tips: 'Poignées à hauteur du milieu de la poitrine, omoplates contre le dossier ; pousse sans verrouiller les coudes.' },
  { id: 'm_shoulder_press', machine: true, name: 'Développé épaules machine (Shoulder press)', primary: ['shoulders'], secondary: ['triceps'], equipment: [G], kind: 'compound', increment: 5, tips: 'Siège réglé pour que les poignées partent à hauteur des épaules ; dos collé au dossier.' },
  { id: 'm_seated_row', machine: true, name: 'Tirage horizontal machine (Seated row)', primary: ['back'], secondary: ['biceps', 'shoulders'], equipment: [G], kind: 'compound', increment: 5, tips: 'Poitrine contre l’appui, tire les coudes vers l’arrière en serrant les omoplates.' },
  { id: 'm_rear_delt', machine: true, name: 'Oiseau machine (Rear delt fly)', primary: ['shoulders'], secondary: ['back'], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Face à la machine, poitrine contre le dossier, bras presque tendus : ouvre en arc jusqu’à l’alignement des épaules.' },
  { id: 'm_arm_curl', machine: true, name: 'Curl biceps machine (Arm curl)', primary: ['biceps'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Arrière des bras à plat sur le pupitre, coudes alignés avec l’axe rouge de la machine.' },
  { id: 'm_triceps_press', machine: true, name: 'Dips assis machine (Triceps press)', primary: ['triceps'], secondary: ['chest', 'shoulders'], equipment: [G], kind: 'compound', increment: 5, tips: 'Dos contre le dossier, pousse les poignées vers le bas jusqu’à l’extension des bras, coudes près du corps.' },
  { id: 'm_ab_crunch', machine: true, name: 'Crunch machine (Abdominal crunch)', primary: ['abs'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Enroule le buste en rapprochant les côtes du bassin ; ce ne sont pas les bras qui tirent.' },
  { id: 'm_back_ext', machine: true, name: 'Extension du dos machine (Back extension)', primary: ['back'], secondary: ['glutes'], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Mouvement lent et contrôlé jusqu’à l’alignement du buste, sans se cambrer.' },
  { id: 'm_rotary_torso', machine: true, name: 'Rotation du buste (Rotary torso)', primary: ['abs'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Le bassin reste fixe, seul le buste tourne ; amplitude modérée, des deux côtés.' },
  { id: 'm_vertical_leg_press', machine: true, name: 'Presse verticale (Vertical leg press)', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [G], kind: 'compound', increment: 5 },
  { id: 'm_lying_leg_curl', machine: true, name: 'Curl jambes allongé (Lying leg curl)', primary: ['hamstrings'], secondary: ['calves'], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Genoux juste au bord du coussin, hanches plaquées : ramène les talons vers les fessiers.' },
  { id: 'm_hip_thrust', machine: true, name: 'Hip thrust machine (Hip thrust)', primary: ['glutes'], secondary: ['hamstrings'], equipment: [G], kind: 'compound', increment: 5, tips: 'Haut du dos sur l’appui, monte les hanches jusqu’à l’alignement genoux-hanches-épaules en serrant les fessiers.' },
  { id: 'm_abductor', machine: true, name: 'Abducteurs machine (Abductor)', primary: ['glutes'], secondary: [], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Ouvre les cuisses contre les coussins en gardant le dos contre le dossier ; retour lent.' },
  { id: 'm_adductor', machine: true, name: 'Adducteurs machine (Adductor)', primary: ['hamstrings'], secondary: ['glutes'], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Ferme les cuisses sans à-coup ; règle l’écartement de départ pour sentir l’étirement sans douleur. (Adducteurs comptés avec les ischios.)' },
  { id: 'm_glute', machine: true, name: 'Fessiers machine (Glute)', primary: ['glutes'], secondary: ['hamstrings'], equipment: [G], kind: 'isolation', increment: 2.5, tips: 'Pousse la jambe vers l’arrière avec le talon, sans cambrer le bas du dos.' },
  { id: 'm_standing_calf', machine: true, name: 'Mollets debout machine (Standing calf)', primary: ['calves'], secondary: [], equipment: [G], kind: 'isolation', increment: 5, tips: 'Talons bien en dessous de la marche en bas, pause d’une seconde en haut.' },
  { id: 'm_smith_squat', machine: true, name: 'Squat guidé (Smith machine squat)', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: [G], kind: 'compound', increment: 2.5, tips: 'Pieds légèrement en avant de la barre pour garder le buste droit.' },
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  return byId.get(id) ?? { id, name: id, primary: [], secondary: [], equipment: [], kind: 'isolation', increment: 2.5 };
}
