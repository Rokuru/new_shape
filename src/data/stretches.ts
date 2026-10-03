import type { Muscle, PlannedExercise } from '../lib/types';

export interface Stretch {
  id: string;
  name: string;
  /** Muscles étirés (le premier est le principal). */
  muscles: Muscle[];
  /** Durée de maintien conseillée, par côté si `sides`. */
  holdSec: number;
  /** À faire de chaque côté. */
  sides?: boolean;
  steps: string[];
}

/**
 * Étirements statiques de fin de séance. Repères (ACSM, Behm et al. 2016) : 15 à 30 s par maintien, 2 fois,
 * soit ~60 s par muscle, sans douleur. Avant une séance lourde, préférer un échauffement dynamique :
 * des étirements statiques longs (> 60 s) juste avant baissent un peu la force.
 */
export const STRETCHES: Stretch[] = [
  {
    id: 'st_chest_door',
    name: 'Pectoraux au cadre de porte',
    muscles: ['chest', 'shoulders'],
    holdSec: 30,
    sides: true,
    steps: ['Avant-bras contre le montant, coude à hauteur d’épaule.', 'Avance doucement le buste jusqu’à sentir l’étirement du pectoral.', 'Épaule basse, sans cambrer.'],
  },
  {
    id: 'st_lats_child',
    name: 'Dorsaux en posture de l’enfant',
    muscles: ['back', 'shoulders'],
    holdSec: 30,
    steps: ['À genoux, fesses vers les talons.', 'Bras tendus loin devant, front vers le sol.', 'Décale les mains d’un côté puis de l’autre pour cibler chaque dorsal.'],
  },
  {
    id: 'st_cat_cow',
    name: 'Chat-vache (dos)',
    muscles: ['back', 'abs'],
    holdSec: 30,
    steps: ['À quatre pattes, mains sous les épaules.', 'Arrondis le dos en expirant, puis creuse-le en inspirant.', 'Mouvement lent, 6 à 8 cycles.'],
  },
  {
    id: 'st_shoulder_cross',
    name: 'Épaule bras croisé',
    muscles: ['shoulders', 'back'],
    holdSec: 30,
    sides: true,
    steps: ['Bras tendu devant toi, ramène-le contre la poitrine avec l’autre main.', 'Épaule basse, loin de l’oreille.'],
  },
  {
    id: 'st_triceps_overhead',
    name: 'Triceps derrière la tête',
    muscles: ['triceps', 'shoulders'],
    holdSec: 30,
    sides: true,
    steps: ['Main dans le dos, coude vers le plafond.', 'Avec l’autre main, pousse doucement le coude vers l’arrière.', 'Garde la tête droite.'],
  },
  {
    id: 'st_biceps_wall',
    name: 'Biceps contre le mur',
    muscles: ['biceps', 'chest'],
    holdSec: 30,
    sides: true,
    steps: ['Paume contre le mur à hauteur d’épaule, bras tendu, doigts vers l’arrière.', 'Tourne lentement le buste à l’opposé du mur.'],
  },
  {
    id: 'st_quad_standing',
    name: 'Quadriceps debout (talon-fesse)',
    muscles: ['quads'],
    holdSec: 30,
    sides: true,
    steps: ['Debout, attrape la cheville et rapproche le talon de la fesse.', 'Genoux serrés, bassin légèrement rétroversé (fesses serrées).', 'Tiens-toi à un support si besoin.'],
  },
  {
    id: 'st_hip_flexor',
    name: 'Fléchisseurs de hanche en fente basse',
    muscles: ['quads', 'glutes'],
    holdSec: 30,
    sides: true,
    steps: ['Genou arrière au sol, pied avant à plat.', 'Serre la fesse du côté du genou au sol et avance légèrement le bassin.', 'Buste droit, sans cambrer.'],
  },
  {
    id: 'st_hamstring_seated',
    name: 'Ischios assis jambe tendue',
    muscles: ['hamstrings', 'calves'],
    holdSec: 30,
    sides: true,
    steps: ['Assis, une jambe tendue, l’autre pliée pied contre la cuisse.', 'Penche-toi depuis les hanches, dos plat, vers le pied.', 'Pas besoin de toucher le pied.'],
  },
  {
    id: 'st_glute_figure4',
    name: 'Fessiers en « 4 » allongé',
    muscles: ['glutes', 'hamstrings'],
    holdSec: 30,
    sides: true,
    steps: ['Sur le dos, cheville posée sur le genou opposé.', 'Attrape l’arrière de la cuisse d’appui et ramène-la vers toi.', 'Tête et épaules relâchées au sol.'],
  },
  {
    id: 'st_calf_wall',
    name: 'Mollets contre le mur',
    muscles: ['calves'],
    holdSec: 30,
    sides: true,
    steps: ['Mains au mur, une jambe en arrière, talon au sol, genou tendu.', 'Avance le bassin jusqu’à sentir le mollet.', 'Puis genou légèrement fléchi pour le soléaire.'],
  },
  {
    id: 'st_cobra',
    name: 'Abdominaux en cobra',
    muscles: ['abs'],
    holdSec: 20,
    steps: ['À plat ventre, mains sous les épaules.', 'Pousse doucement pour soulever le buste, hanches au sol.', 'Reste dans une amplitude confortable pour le bas du dos.'],
  },
  {
    id: 'st_knees_chest',
    name: 'Bas du dos genoux-poitrine',
    muscles: ['back', 'glutes'],
    holdSec: 30,
    steps: ['Sur le dos, ramène les deux genoux contre la poitrine.', 'Bas du dos plaqué au sol, respire lentement.'],
  },
  {
    id: 'st_adductors',
    name: 'Adducteurs en papillon',
    muscles: ['quads', 'glutes'],
    holdSec: 30,
    steps: ['Assis, plantes de pieds collées, talons vers le bassin.', 'Dos droit, laisse les genoux descendre ; pousse-les doucement avec les coudes.'],
  },
];

const byId = new Map(STRETCHES.map((s) => [s.id, s]));
export const getStretch = (id: string) => byId.get(id);

/** Durée totale d'une liste d'étirements (2 maintiens par côté), en minutes. */
export function stretchMinutes(ids: string[]): number {
  const sec = ids.reduce((t, id) => {
    const s = byId.get(id);
    return s ? t + s.holdSec * 2 * (s.sides ? 2 : 1) + 10 : t;
  }, 0);
  return Math.max(1, Math.round(sec / 60));
}

/**
 * Étirements conseillés pour une séance : on couvre d'abord les muscles les plus travaillés
 * (muscle principal d'un exercice = 2 points par série, secondaire = 1), 5 étirements au plus.
 */
export function suggestStretches(exercises: Pick<PlannedExercise, 'exerciseId' | 'sets'>[], getMuscles: (id: string) => { primary: Muscle[]; secondary: Muscle[] }, max = 5): string[] {
  const load = new Map<Muscle, number>();
  for (const e of exercises) {
    const m = getMuscles(e.exerciseId);
    for (const p of m.primary) load.set(p, (load.get(p) ?? 0) + 2 * e.sets);
    for (const s of m.secondary) load.set(s, (load.get(s) ?? 0) + e.sets);
  }
  const ranked = [...load.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  const out: string[] = [];
  for (const muscle of ranked) {
    if (out.length >= max) break;
    const covered = out.some((id) => byId.get(id)!.muscles[0] === muscle);
    if (covered) continue;
    const pick = STRETCHES.find((s) => s.muscles[0] === muscle && !out.includes(s.id));
    if (pick) out.push(pick.id);
  }
  return out;
}
