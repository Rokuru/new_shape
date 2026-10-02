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

/** Études citées par plusieurs programmes. */
const STUDY = {
  frequency: { label: 'Schoenfeld et al. 2016 – fréquence et hypertrophie (méta-analyse, Sports Med)', url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/' },
  volume: { label: 'Schoenfeld, Ogborn & Krieger 2017 – dose-réponse du volume hebdomadaire (méta-analyse, J Sports Sci)', url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/' },
  failure: {
    label: 'Refalo et al. 2023 – proximité de l’échec et hypertrophie (méta-analyse, Sports Med)',
    url: 'https://dro.deakin.edu.au/articles/journal_contribution/Influence_of_Resistance_Training_Proximity-to-Failure_on_Skeletal_Muscle_Hypertrophy_A_Systematic_Review_with_Meta-analysis/22030796',
  },
  loads: { label: 'Schoenfeld et al. 2017 – charges lourdes vs légères (méta-analyse, JSCR)', url: 'https://pubmed.ncbi.nlm.nih.gov/28834797/' },
};

/**
 * Programmes de référence, inspirés de méthodes publiques reconnues.
 * Ce sont des adaptations simplifiées : les auteurs cités sont la source d'inspiration,
 * pas les éditeurs de ces versions.
 */
export const PROGRAMS: Program[] = [
  {
    id: 'linear_5x5',
    name: 'Force linéaire 5×5 (A/B)',
    author: 'Inspiré de StrongLifts 5×5 (Mehdi), lui-même issu du 5×5 de Bill Starr',
    description:
      'Programme débutant en full body, 3 séances par semaine en alternant A et B. On ajoute du poids à chaque séance réussie. Idéal pour les 3 à 6 premiers mois.',
    level: ['beginner'],
    goals: ['strength', 'recomp', 'bulk'],
    daysPerWeek: 3,
    progression: '+2,5 kg par séance sur les exercices du haut, +5 kg sur le soulevé de terre si toutes les séries sont réussies. Après 3 échecs consécutifs : -10 %.',
    style: 'force',
    evidence: 'La progression linéaire exploite l’« effet débutant » : tant que la récupération suit, on ajoute du poids à chaque séance (souvent 3 à 6 mois). Très efficace pour la force ; volume faible pour les bras, les mollets et les épaules : ce n’est pas un programme d’hypertrophie complet.',
    sources: [{ label: 'StrongLifts 5×5 – guide officiel', url: 'https://stronglifts.com/5x5/' }, { label: 'Starting Strength – programmes', url: 'https://startingstrength.com/get-started/programs' }],
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
    style: 'powerbuilding',
    evidence: 'Combine charges lourdes (T1), modérées (T2) et légères proches de l’échec (T3) : cohérent avec les méta-analyses qui montrent une hypertrophie comparable sur une large gamme de charges quand l’effort est suffisant.',
    sources: [{ label: 'Cody Lefever – GZCL Applications & Adaptations', url: 'https://swoleateveryheight.blogspot.com/2016/02/gzcl-applications-adaptations.html' }, STUDY.loads],
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
    style: 'force',
    evidence: 'Progression mensuelle (et non par séance) : adaptée aux intermédiaires qui ne progressent plus en linéaire. Le 5×10 apporte un volume élevé sur les grands mouvements ; peu de travail d’isolation.',
    sources: [{ label: 'Jim Wendler – Boring But Big', url: 'https://www.jimwendler.com/blogs/jimwendler-com/101065094-boring-but-big' }],
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
    style: 'powerbuilding',
    evidence: 'Chaque muscle 2×/semaine avec un jour lourd et un jour hypertrophie : conforme aux méta-analyses sur la fréquence. Bon équilibre force / volume pour 4 séances.',
    sources: [{ label: 'Muscle & Strength – PHUL (Brandon Campbell)', url: 'https://www.muscleandstrength.com/workouts/phul-workout' }, STUDY.frequency],
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
    style: 'hypertrophie',
    evidence: 'Fréquence 2×/semaine et volume élevé (souvent > 15 séries par muscle) : dans le haut des recommandations. Demande 6 séances et une bonne récupération.',
    sources: [{ label: 'r/Fitness – PPL de Metallicadpa', url: 'https://www.reddit.com/r/Fitness/comments/37ylk5/a_linear_progression_based_ppl_program_for/' }, STUDY.volume],
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
    style: 'hypertrophie',
    evidence: 'Construit directement sur les méta-analyses : 2×/semaine par muscle, 10–20 séries hebdomadaires, séries à 0–3 répétitions de l’échec (l’échec total n’apporte pas plus d’après Refalo 2023).',
    sources: [STUDY.frequency, STUDY.volume, STUDY.failure],
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
    style: 'hypertrophie',
    evidence: 'Avec des haltères légers, l’hypertrophie reste comparable à des charges lourdes si les séries sont menées près de l’échec (méta-analyse Schoenfeld 2017). La force maximale progresse moins.',
    sources: [STUDY.loads, STUDY.failure],
    days: [
      { name: 'Full body A', exercises: [ex('goblet_squat', 3, 10, 15, 1, 90), ex('db_bench', 3, 8, 12, 1, 90), ex('db_row', 3, 8, 12, 1, 90), ex('lateral_raise', 3, 12, 20, 0, 60), ex('db_curl', 2, 10, 15, 0, 60)] },
      { name: 'Full body B', exercises: [ex('rdl', 3, 8, 12, 2, 120), ex('db_ohp', 3, 8, 12, 1, 90), ex('pushup', 3, 10, 20, 1, 60), ex('bulgarian_split', 3, 8, 12, 1, 90), ex('overhead_ext', 2, 10, 15, 0, 60)] },
      { name: 'Full body C', exercises: [ex('bulgarian_split', 3, 10, 12, 1, 90), ex('incline_db', 3, 8, 12, 1, 90), ex('db_row', 3, 10, 12, 1, 90), ex('hip_thrust', 3, 10, 15, 1, 90), ex('hammer_curl', 2, 10, 15, 0, 60), ex('plank', 3, 30, 60, 1, 60)] },
    ],
  },

  // ——— Force ———
  {
    id: 'starting_strength',
    name: 'Starting Strength (phase 3)',
    author: 'Inspiré de Mark Rippetoe – Starting Strength (3e éd., 2011)',
    description:
      'Le programme débutant de référence en force : 3 séances par semaine en alternant A et B (semaine 1 : A/B/A, semaine 2 : B/A/B). Squat à chaque séance, épaulé et tractions pour le dos.',
    level: ['beginner'],
    goals: ['strength', 'bulk'],
    daysPerWeek: 3,
    style: 'force',
    progression: 'Ajouter du poids à chaque séance : +2,5 à 5 kg au squat et au soulevé de terre, +1 à 2,5 kg au développé. Après 2 échecs sur la même charge : −10 % et remonter.',
    evidence:
      'Repose sur l’« effet débutant » : un novice récupère assez en 48 h pour battre un record à chaque séance. Volume faible et très peu d’isolation : excellent pour la force et la technique, insuffisant à terme pour les bras, les épaules et les mollets.',
    sources: [
      { label: 'Starting Strength – programmes officiels', url: 'https://startingstrength.com/get-started/programs' },
      { label: 'Boostcamp – Starting Strength (Mark Rippetoe)', url: 'https://www.boostcamp.app/mark-rippetoe/starting-strength' },
    ],
    days: [
      { name: 'Séance A', exercises: [ex('squat', 3, 5, 5, 1, 240), ex('ohp', 3, 5, 5, 1, 180), ex('deadlift', 1, 5, 5, 1, 240), ex('chinup', 3, 5, 10, 1, 120, 'Phase 3 : en alternance avec l’épaulé')] },
      { name: 'Séance B', exercises: [ex('squat', 3, 5, 5, 1, 240), ex('bench', 3, 5, 5, 1, 180), ex('power_clean', 5, 3, 3, 2, 150)] },
    ],
  },
  {
    id: 'texas_method',
    name: 'Texas Method',
    author: 'Inspiré de Mark Rippetoe & Lon Kilgore – Practical Programming for Strength Training',
    description:
      'Programme intermédiaire de force sur 3 jours : lundi volume (5×5 à ~90 % du 5RM), mercredi récupération (charges légères), vendredi intensité (nouveau record sur 5). Développé couché et militaire alternent chaque semaine.',
    level: ['intermediate'],
    goals: ['strength', 'bulk'],
    daysPerWeek: 3,
    style: 'force',
    progression: 'Record de 5 répétitions le vendredi : +2,5 kg (bas) / +1 kg (haut) par semaine. Lundi à ~90 % du 5RM, mercredi à 80 % du lundi. En cas de stagnation : baisser le volume du lundi (5×5 → 4×5 → 3×5).',
    evidence:
      'Applique le schéma stress → récupération → adaptation sur une semaine, adapté quand la progression séance après séance s’arrête. Très centré sur 4 mouvements : volume d’isolation quasi nul et lundis exigeants.',
    sources: [
      { label: 'Starting Strength – forum, modèle Texas Method', url: 'https://startingstrength.com/resources/forum/general-programming/37601-texas-method-template.html' },
      { label: 'Powerlifting to Win – analyse du Texas Method', url: 'https://www.powerliftingtowin.com/?p=1723' },
    ],
    days: [
      { name: 'Lundi – Volume', exercises: [ex('squat', 5, 5, 5, 2, 240, '~90 % du 5RM'), ex('bench', 5, 5, 5, 2, 180, 'Alterner avec le militaire chaque semaine'), ex('deadlift', 1, 5, 5, 1, 240)] },
      { name: 'Mercredi – Récupération', exercises: [ex('squat', 2, 5, 5, 4, 180, '80 % du lundi'), ex('ohp', 3, 5, 5, 3, 150, 'Le mouvement non travaillé lundi'), ex('chinup', 3, 5, 12, 1, 120), ex('back_extension', 3, 10, 10, 2, 90)] },
      { name: 'Vendredi – Intensité', exercises: [ex('squat', 1, 5, 5, 0, 300, 'Nouveau record sur 5'), ex('bench', 1, 5, 5, 0, 240, 'Même mouvement que lundi'), ex('power_clean', 5, 3, 3, 2, 150)] },
    ],
  },
  {
    id: 'madcow_5x5',
    name: 'Madcow 5×5 (lourd / léger / moyen)',
    author: 'Inspiré du 5×5 de Bill Starr (The Strongest Shall Survive, 1976), version « Madcow »',
    description:
      'Suite logique du 5×5 débutant. Séries montantes jusqu’à une série lourde : lundi lourd sur 5, mercredi léger, vendredi record sur 3 puis une série de 8 plus légère. Progression hebdomadaire.',
    level: ['intermediate'],
    goals: ['strength', 'bulk', 'recomp'],
    daysPerWeek: 3,
    style: 'force',
    progression: 'Séries montantes par paliers de 12,5 % jusqu’au top set. Top set du lundi +2,5 % par semaine ; le triple du vendredi est 2,5 % au-dessus du lundi. Compter 8 à 12 semaines avant de changer.',
    evidence:
      'Progression hebdomadaire et fréquence 3×/semaine sur le squat : bonne transition après un programme débutant. Les séries montantes comptent peu comme séries « dures » : le volume effectif est modéré.',
    sources: [
      { label: 'StrongLifts – guide Madcow 5×5', url: 'https://stronglifts.com/madcow-5x5/workout-guide' },
      { label: 'Muscle & Strength – 5×5 linéaire de Bill Starr', url: 'https://www.muscleandstrength.com/node/4494' },
    ],
    days: [
      {
        name: 'Lundi – Lourd',
        exercises: [ex('squat', 5, 5, 5, 1, 180, 'Montantes : 50 → 100 %'), ex('bench', 5, 5, 5, 1, 180, 'Montantes : 50 → 100 %'), ex('barbell_row', 5, 5, 5, 1, 150, 'Montantes : 50 → 100 %'), ex('dips', 2, 5, 8, 2, 120), ex('crunch', 2, 10, 20, 2, 60)],
      },
      { name: 'Mercredi – Léger', exercises: [ex('squat', 4, 5, 5, 4, 150, 'Paliers 1–3 du lundi, 4e = 3e'), ex('ohp', 4, 5, 5, 2, 150, 'Montantes'), ex('deadlift', 4, 5, 5, 2, 210, 'Montantes'), ex('crunch', 3, 10, 20, 2, 60)] },
      {
        name: 'Vendredi – Moyen',
        exercises: [
          ex('squat', 4, 5, 5, 3, 150, 'Montantes'),
          ex('squat', 1, 3, 3, 0, 240, 'Top +2,5 % vs lundi'),
          ex('squat', 1, 8, 8, 1, 150, 'Au 3e palier'),
          ex('bench', 4, 5, 5, 3, 120, 'Montantes'),
          ex('bench', 1, 3, 3, 0, 180, 'Top +2,5 % vs lundi'),
          ex('bench', 1, 8, 8, 1, 120, 'Au 3e palier'),
          ex('barbell_row', 4, 5, 5, 3, 120, 'Montantes'),
          ex('barbell_row', 1, 3, 3, 0, 150, 'Top +2,5 % vs lundi'),
          ex('barbell_row', 1, 8, 8, 1, 120, 'Au 3e palier'),
          ex('dips', 3, 5, 8, 2, 90),
          ex('barbell_curl', 3, 8, 8, 2, 60),
        ],
      },
    ],
  },

  // ——— Powerbuilding ———
  {
    id: 'phat',
    name: 'PHAT – Power Hypertrophy Adaptive Training',
    author: 'Inspiré de Layne Norton (PhD en sciences de la nutrition, culturiste naturel et powerlifter)',
    description:
      '5 séances : 2 jours de force (haut / bas) en début de semaine, puis 3 jours d’hypertrophie (dos-épaules, jambes, pecs-bras) qui commencent par des séries de vitesse à 65–70 %.',
    level: ['intermediate', 'advanced'],
    goals: ['bulk', 'strength', 'recomp'],
    daysPerWeek: 5,
    style: 'powerbuilding',
    progression: 'Jours de force : charge augmentée dès que le haut de la fourchette (3–5) est atteint. Séries de vitesse : 65–70 % du 3–5RM, exécution explosive. Hypertrophie : double progression. Décharge toutes les 6 à 12 semaines.',
    evidence:
      'Fréquence 2×/semaine et volume élevé (souvent 15–20 séries par muscle) : en accord avec les méta-analyses, mais exigeant sur 5 jours. Les séries de vitesse servent surtout la technique et la puissance.',
    sources: [
      { label: 'Boostcamp – PHAT (Layne Norton)', url: 'https://boostcamp.app/layne-norton/phat' },
      { label: 'BarBend – PHAT training', url: 'https://barbend.com/phat-training/' },
      STUDY.volume,
    ],
    days: [
      {
        name: 'Haut – Force',
        exercises: [ex('barbell_row', 3, 3, 5, 1, 180, 'Pendlay row'), ex('pullup', 2, 6, 10, 1, 120, 'Lestées'), ex('chinup', 2, 6, 10, 1, 120), ex('db_bench', 3, 3, 5, 1, 180), ex('dips', 2, 6, 10, 1, 120, 'Lestés'), ex('db_ohp', 3, 6, 10, 1, 120), ex('barbell_curl', 3, 6, 10, 1, 90), ex('skull_crusher', 3, 6, 10, 1, 90)],
      },
      {
        name: 'Bas – Force',
        exercises: [ex('squat', 3, 3, 5, 1, 240), ex('hack_squat', 2, 6, 10, 1, 150), ex('leg_ext', 2, 6, 10, 1, 90), ex('rdl', 3, 5, 8, 1, 150, 'Jambes tendues'), ex('leg_curl', 2, 6, 10, 1, 90), ex('calf_raise', 3, 6, 8, 1, 60), ex('seated_calf', 2, 6, 10, 1, 60)],
      },
      {
        name: 'Dos & épaules – Hypertrophie',
        exercises: [ex('barbell_row', 6, 3, 3, 4, 60, 'Vitesse : 65–70 % du 3–5RM'), ex('pullup', 3, 8, 12, 1, 90), ex('cable_row', 3, 8, 12, 1, 90), ex('lat_pulldown', 2, 15, 20, 1, 60, 'Prise serrée'), ex('db_ohp', 3, 8, 12, 1, 90), ex('lateral_raise', 3, 12, 20, 1, 60), ex('face_pull', 3, 12, 20, 1, 60)],
      },
      {
        name: 'Jambes – Hypertrophie',
        exercises: [ex('squat', 6, 3, 3, 4, 60, 'Vitesse : 65–70 % du 3–5RM'), ex('hack_squat', 3, 8, 12, 1, 120), ex('leg_press', 2, 12, 15, 1, 120), ex('leg_ext', 3, 15, 20, 1, 60), ex('rdl', 3, 8, 12, 1, 120), ex('leg_curl', 2, 12, 15, 1, 60), ex('calf_raise', 4, 10, 15, 1, 60), ex('seated_calf', 3, 15, 20, 1, 60)],
      },
      {
        name: 'Pecs & bras – Hypertrophie',
        exercises: [ex('db_bench', 6, 3, 3, 4, 60, 'Vitesse : 65–70 % du 3–5RM'), ex('incline_db', 3, 8, 12, 1, 90), ex('pec_deck', 2, 12, 15, 1, 60), ex('cable_fly', 2, 15, 20, 1, 60), ex('preacher_curl', 3, 8, 12, 1, 60), ex('db_curl', 2, 12, 15, 1, 60), ex('overhead_ext', 3, 8, 12, 1, 60), ex('triceps_pushdown', 2, 12, 15, 1, 60)],
      },
    ],
  },

  // ——— Hypertrophie ———
  {
    id: 'helms_pyramid',
    name: 'Muscle & Strength Pyramid – intermédiaire 5 j',
    author: 'Inspiré d’Eric Helms, Andy Morgan & Andrea Valdez – The Muscle and Strength Pyramid: Training',
    description:
      'Structure du programme intermédiaire du livre : bas / haut / bas / poussée / tirage. Charges ondulées dans la semaine (jours lourds 4–6 reps, jours légers 8–15), effort piloté au RPE.',
    level: ['intermediate'],
    goals: ['bulk', 'recomp', 'cut'],
    daysPerWeek: 5,
    style: 'hypertrophie',
    progression: 'Au RPE : quand toutes les séries atteignent le haut de la fourchette à RPE ≤ 8 (2 répétitions en réserve), augmenter la charge. Blocs de 4 à 6 semaines terminés par une décharge.',
    evidence:
      'Rédigé par des chercheurs-coachs à partir des méta-analyses : 10–20 séries par muscle et par semaine, fréquence 2×, majorité des séries à 1–3 répétitions de l’échec. Le RPE demande un peu d’apprentissage.',
    sources: [
      { label: 'Boostcamp – Intermediate Bodybuilding Program (Muscle & Strength Pyramid)', url: 'https://www.boostcamp.app/muscle-and-strength-pyramid/intermediate-bodybuilding-program' },
      { label: 'The Muscle and Strength Pyramids (site officiel)', url: 'https://muscleandstrengthpyramids.com/' },
      STUDY.volume,
      STUDY.failure,
    ],
    days: [
      { name: 'Bas 1 – Lourd', exercises: [ex('squat', 4, 4, 6, 2, 210), ex('rdl', 3, 6, 8, 2, 150), ex('bulgarian_split', 3, 8, 10, 2, 90), ex('leg_curl', 3, 10, 12, 1, 75), ex('calf_raise', 4, 8, 12, 1, 60), ex('cable_crunch', 3, 10, 15, 1, 60)] },
      { name: 'Haut – Lourd', exercises: [ex('bench', 4, 4, 6, 2, 180), ex('barbell_row', 4, 6, 8, 2, 150), ex('ohp', 3, 6, 8, 2, 150), ex('pullup', 3, 6, 10, 2, 120), ex('triceps_pushdown', 2, 10, 12, 1, 60), ex('barbell_curl', 2, 10, 12, 1, 60)] },
      { name: 'Bas 2 – Volume', exercises: [ex('deadlift', 3, 4, 6, 2, 210), ex('front_squat', 3, 8, 10, 2, 150), ex('hip_thrust', 3, 8, 12, 1, 90), ex('leg_ext', 3, 12, 15, 1, 60), ex('leg_curl', 3, 12, 15, 1, 60), ex('seated_calf', 4, 12, 15, 1, 60)] },
      { name: 'Poussée', exercises: [ex('incline_db', 4, 8, 12, 1, 120), ex('db_ohp', 3, 8, 12, 1, 90), ex('dips', 3, 8, 12, 1, 90), ex('cable_fly', 3, 12, 15, 1, 60), ex('lateral_raise', 4, 12, 20, 1, 60), ex('overhead_ext', 3, 10, 15, 1, 60)] },
      { name: 'Tirage', exercises: [ex('lat_pulldown', 4, 8, 12, 1, 90), ex('cable_row', 4, 8, 12, 1, 90), ex('db_row', 3, 10, 12, 1, 75), ex('face_pull', 3, 15, 20, 1, 60), ex('db_curl', 3, 10, 15, 1, 60), ex('hammer_curl', 2, 10, 15, 1, 60)] },
    ],
  },
  {
    id: 'lyle_gbr',
    name: 'Generic Bulking Routine (haut / bas)',
    author: 'Inspiré de Lyle McDonald (bodyrecomposition.com)',
    description:
      '4 séances haut / bas (lundi, mardi, jeudi, vendredi), deux séances identiques de chaque. Un bloc lourd 6–8 reps puis un bloc 10–12 : simple et efficace en prise de masse.',
    level: ['beginner', 'intermediate'],
    goals: ['bulk', 'recomp'],
    daysPerWeek: 4,
    style: 'hypertrophie',
    progression: 'Double progression : commencer en bas de fourchette, monter jusqu’au haut sur toutes les séries, puis +2,5 kg et repartir. Prévu pour un surplus de 250 à 500 kcal par jour. Cycles de 6 à 8 semaines.',
    evidence:
      'Fréquence 2×/semaine et 6–10 séries par grand groupe musculaire : volume modéré, au niveau du minimum efficace pour les bras. Points forts : simplicité, récupération facile, très bon point de départ après un programme débutant.',
    sources: [
      { label: 'JCD Fitness – Lyle McDonald’s bulking routine', url: 'https://jcdfitness.com/2009/01/lyle-mcdonalds-bulking-routine/' },
      { label: 'Lift Vault – Lyle McDonald bulking routine', url: 'https://liftvault.com/programs/bodybuilding/lyle-mcdonald-bulking-workout-routine-spreadsheet/' },
      STUDY.frequency,
    ],
    days: [
      { name: 'Bas', exercises: [ex('squat', 3, 6, 8, 1, 180), ex('rdl', 3, 6, 8, 1, 150), ex('leg_press', 2, 10, 12, 1, 120), ex('leg_curl', 2, 10, 12, 1, 90), ex('calf_raise', 3, 6, 8, 1, 90), ex('seated_calf', 2, 10, 12, 1, 60)] },
      { name: 'Haut', exercises: [ex('bench', 3, 6, 8, 1, 180), ex('barbell_row', 3, 6, 8, 1, 180), ex('incline_db', 2, 10, 12, 1, 120, 'Ou développé militaire'), ex('lat_pulldown', 2, 10, 12, 1, 120, 'Ou tractions'), ex('triceps_pushdown', 2, 12, 15, 1, 60), ex('barbell_curl', 2, 12, 15, 1, 60)] },
    ],
  },
  {
    id: 'gvt',
    name: 'German Volume Training (10×10)',
    author: 'Inspiré de Charles Poliquin (méthode allemande des années 1970, diffusée par Poliquin)',
    description:
      'Bloc de choc de 4 à 6 semaines : 10 séries de 10 sur un exercice de base à ~60 % du 1RM, 60–90 s de repos, en alternance avec l’antagoniste. Rotation sur 5 jours (3 séances + 2 repos).',
    level: ['intermediate', 'advanced'],
    goals: ['bulk'],
    daysPerWeek: 4,
    style: 'hypertrophie',
    progression: 'Garder la même charge tant que 10×10 n’est pas réussi ; ensuite +2 à 5 %. Tempo 4-0-2-0 sur les exercices de base. Au-delà de 6 semaines, passer à un bloc plus lourd.',
    evidence:
      'Les études qui l’ont testé ne trouvent pas d’avantage à 10 séries : 5×10 a donné autant voire plus de muscle et de force (Amirthalingam 2017, Hackett 2018). À utiliser comme bloc court, ou en version 5×10.',
    sources: [
      { label: 'Wikipédia – German volume training', url: 'https://en.wikipedia.org/wiki/German_volume_training' },
      { label: 'Amirthalingam et al. 2017 – GVT modifié : 10 vs 5 séries', url: 'https://www.bisp-surf.de/Record/PU201711009630' },
      { label: 'Hackett et al. 2018 – GVT 12 semaines (étude pilote, Sports)', url: 'https://pubmed.ncbi.nlm.nih.gov/29910312/' },
    ],
    days: [
      { name: 'Pecs & dos', exercises: [ex('incline_db', 10, 10, 10, 2, 90, 'A1 – 60 % du 1RM'), ex('chinup', 10, 10, 10, 2, 90, 'A2 – en alternance'), ex('db_fly', 3, 10, 12, 1, 60, 'B1'), ex('db_row', 3, 10, 12, 1, 60, 'B2')] },
      { name: 'Jambes & abdos', exercises: [ex('squat', 10, 10, 10, 2, 90, 'A1 – 60 % du 1RM'), ex('leg_curl', 10, 10, 10, 2, 90, 'A2 – en alternance'), ex('seated_calf', 3, 15, 20, 1, 60, 'B1'), ex('crunch', 3, 15, 20, 1, 60, 'B2')] },
      { name: 'Bras & épaules', exercises: [ex('dips', 10, 10, 10, 2, 90, 'A1'), ex('hammer_curl', 10, 10, 10, 2, 90, 'A2 – en alternance'), ex('rear_delt_fly', 3, 10, 12, 1, 60, 'B1'), ex('lateral_raise', 3, 10, 12, 1, 60, 'B2')] },
    ],
  },
  {
    id: 'fst7',
    name: 'FST-7 (Fascia Stretch Training)',
    author: 'Inspiré de Hany Rambod (coach de Jay Cutler, Phil Heath, Chris Bumstead)',
    description:
      'Split culturiste : chaque groupe commence lourd (6–10 reps, longs repos) puis finit par 7 séries de 10–15 sur une machine ou une poulie, avec 30–45 s de repos, pour une congestion maximale.',
    level: ['intermediate', 'advanced'],
    goals: ['bulk', 'recomp'],
    daysPerWeek: 4,
    style: 'hypertrophie',
    progression: 'Exercices de base : double progression. Série FST-7 : même charge sur les 7 séries ; quand toutes atteignent 12 reps, augmenter. S’hydrater et s’étirer entre les séries.',
    evidence:
      'Le volume total est élevé et la fréquence d’environ 1×/semaine par muscle ; l’idée d’« étirer le fascia » n’est pas démontrée. Les 7 séries finales comptent comme du volume utile, mais un repos de 30 s réduit la charge des séries suivantes.',
    sources: [
      { label: 'Bodybuilding.com – Hany Rambod’s ultimate guide to FST-7', url: 'https://www.bodybuilding.com/fun/hany-rambods-ultimate-guide-to-fst-7' },
      { label: 'Julien Quaglierini – la méthode FST-7 est-elle efficace ?', url: 'https://julienquaglierini.com/en/2023/01/methode-fst-7/' },
      STUDY.frequency,
    ],
    days: [
      { name: 'Bras', exercises: [ex('barbell_curl', 3, 8, 10, 1, 90), ex('preacher_curl', 3, 8, 12, 1, 75), ex('db_curl', 7, 10, 12, 1, 40, 'FST-7 : 30–45 s de repos'), ex('close_grip_bench', 3, 8, 10, 1, 120), ex('skull_crusher', 3, 8, 12, 1, 75), ex('triceps_pushdown', 7, 10, 12, 1, 40, 'FST-7 : 30–45 s de repos')] },
      { name: 'Jambes', exercises: [ex('leg_ext', 3, 12, 15, 2, 60, 'Échauffement'), ex('squat', 3, 8, 10, 1, 180), ex('hack_squat', 3, 8, 12, 1, 120), ex('leg_press', 7, 10, 12, 1, 45, 'FST-7 : 30–45 s de repos'), ex('rdl', 3, 8, 10, 1, 120), ex('leg_curl', 7, 10, 12, 1, 40, 'FST-7'), ex('calf_raise', 7, 10, 15, 1, 40, 'FST-7')] },
      { name: 'Pecs & épaules', exercises: [ex('incline_db', 3, 8, 10, 1, 120), ex('db_bench', 3, 8, 12, 1, 120), ex('cable_fly', 7, 10, 12, 1, 40, 'FST-7 : 30–45 s de repos'), ex('db_ohp', 3, 8, 10, 1, 120), ex('lateral_raise', 7, 12, 15, 1, 40, 'FST-7')] },
      { name: 'Dos & arrière d’épaules', exercises: [ex('pullup', 3, 8, 10, 1, 120), ex('barbell_row', 3, 8, 10, 1, 120), ex('cable_row', 3, 10, 12, 1, 90), ex('lat_pulldown', 7, 10, 12, 1, 40, 'FST-7 : bras tendus ou prise serrée'), ex('rear_delt_fly', 3, 12, 15, 1, 60), ex('crunch', 3, 15, 20, 1, 45)] },
    ],
  },
  {
    id: 'golden_six',
    name: 'Golden Six',
    author: 'Attribué à Arnold Schwarzenegger (routine de ses débuts ; attribution transmise par la tradition, pas par un écrit d’Arnold)',
    description:
      'Full body à l’ancienne : 6 exercices, 3 fois par semaine, toujours la même séance. Simple, rapide à apprendre, idéal pour les 2 à 4 premiers mois ou un retour après une pause.',
    level: ['beginner'],
    goals: ['recomp', 'bulk'],
    daysPerWeek: 3,
    style: 'hypertrophie',
    progression: 'Quand toutes les séries atteignent 10 répétitions (ou +2 reps aux exercices au poids du corps), augmenter la charge de 2,5 kg.',
    evidence:
      'Fréquence 3×/semaine et ~20 séries par séance : volume suffisant pour un débutant. Rien pour les ischios en direct ni pour les mollets ; le développé derrière la nuque d’origine est remplacé ici par le développé devant, moins contraignant pour les épaules.',
    sources: [
      { label: 'Lift Vault – Arnold Golden Six', url: 'https://liftvault.com/programs/bodybuilding/arnold-schwarzenegger-workout-routine-golden-six/' },
      { label: 'Boostcamp – Golden Six', url: 'https://boostcamp.app/arnold-schwarzenegger/golden-six' },
    ],
    days: [
      { name: 'Full body', exercises: [ex('squat', 4, 10, 10, 2, 150), ex('bench', 3, 10, 10, 2, 90, 'Prise large'), ex('chinup', 3, 5, 15, 1, 90, 'Max de répétitions'), ex('ohp', 4, 10, 10, 2, 90, 'À l’origine derrière la nuque'), ex('barbell_curl', 3, 10, 10, 1, 75), ex('crunch', 3, 15, 30, 1, 60, 'Max de répétitions')] },
    ],
  },
  {
    id: 'strong_curves',
    name: 'Strong Curves – Bootyful Beginnings',
    author: 'Inspiré de Bret Contreras (PhD, chercheur sur les fessiers) & Kellie Davis – Strong Curves (2013)',
    description:
      'Programme full body axé fessiers, pensé d’abord pour les femmes mais valable pour tous : chaque séance associe un exercice fessiers + un tirage, un squat ou une fente + une poussée, puis une charnière de hanche et du gainage.',
    level: ['beginner', 'intermediate'],
    goals: ['recomp', 'cut', 'bulk'],
    daysPerWeek: 3,
    style: 'hypertrophie',
    progression: 'Semaines 1–4 : pont fessier au poids du corps, puis hip thrust, puis hip thrust à la barre (semaines 9–12). Ailleurs : +1 à 2 reps par semaine, puis plus de charge.',
    evidence:
      'Volume fessiers très élevé (12–20 séries par semaine) et exercices en position raccourcie et étirée : cohérent avec les travaux de Contreras sur l’activation des fessiers. Haut du corps et bras en volume d’entretien.',
    sources: [
      { label: 'Boostcamp – Strong Curves : Bootyful Beginnings', url: 'https://boostcamp.app/bret-contreras/strong-curves-bootyful-beginnings' },
      { label: 'Bret Contreras – blog', url: 'https://bretcontreras.com/' },
    ],
    days: [
      { name: 'Séance A', exercises: [ex('glute_bridge', 3, 15, 20, 2, 60, 'A1'), ex('db_row', 3, 8, 12, 2, 60, 'A2'), ex('goblet_squat', 3, 8, 12, 2, 60, 'B1'), ex('pushup', 3, 3, 10, 2, 60, 'B2 – sur les genoux ou surélevées si besoin'), ex('rdl', 3, 8, 12, 2, 90), ex('plank', 2, 20, 60, 1, 45), ex('side_plank', 2, 20, 45, 1, 45)] },
      { name: 'Séance B', exercises: [ex('hip_thrust', 3, 10, 20, 2, 60, 'A1'), ex('lat_pulldown', 3, 8, 12, 2, 60, 'A2'), ex('step_up', 3, 8, 12, 2, 60, 'B1'), ex('db_ohp', 3, 8, 12, 2, 60, 'B2'), ex('back_extension', 3, 10, 20, 2, 60), ex('crunch', 2, 10, 20, 1, 45)] },
      { name: 'Séance C', exercises: [ex('glute_bridge', 3, 10, 20, 2, 60, 'A1 – une jambe'), ex('inverted_row', 3, 6, 12, 2, 60, 'A2'), ex('bulgarian_split', 3, 8, 12, 2, 60, 'B1'), ex('db_bench', 3, 8, 12, 2, 60, 'B2'), ex('sl_rdl', 3, 8, 12, 2, 60), ex('side_plank', 2, 20, 45, 1, 45)] },
    ],
  },

  // ——— Haute intensité ———
  {
    id: 'yates_blood_guts',
    name: 'Blood & Guts (HIT)',
    author: 'Inspiré de Dorian Yates (6× Mr. Olympia), dans la lignée d’Arthur Jones et Mike Mentzer',
    description:
      'Haute intensité : après 2–3 séries d’échauffement montantes, une seule série de travail par exercice, menée jusqu’à l’échec. 4 séances par semaine, chaque muscle une fois.',
    level: ['advanced'],
    goals: ['bulk', 'strength'],
    daysPerWeek: 4,
    style: 'haute_intensite',
    progression: 'Battre la séance précédente à chaque fois : +1 répétition ou plus de charge sur la série de travail. Techniques d’intensification (répétitions forcées, négatives) avec prudence.',
    evidence:
      'Volume très faible (≈ 2–5 séries dures par muscle et par semaine) et fréquence 1× : sous le volume recommandé par les méta-analyses pour la plupart des pratiquants naturels. L’échec systématique n’apporte pas plus de muscle (Refalo 2023) et fatigue davantage. Intéressant quand le temps manque ou en phase d’entretien.',
    sources: [
      { label: 'Boostcamp – Dorian Yates 4-day split', url: 'https://boostcamp.app/dorian-yates/dorian-yates-4-day-split' },
      { label: 'Muscle & Strength – routine culturiste des années 1990', url: 'https://www.muscleandstrength.com/node/47131' },
      STUDY.volume,
      STUDY.failure,
    ],
    days: [
      { name: 'Épaules, triceps, abdos', exercises: [ex('db_ohp', 1, 6, 8, 0, 180, 'Après 2 séries d’échauffement'), ex('lateral_raise', 1, 8, 10, 0, 120), ex('rear_delt_fly', 1, 8, 10, 0, 120), ex('triceps_pushdown', 1, 8, 10, 0, 120), ex('skull_crusher', 1, 8, 10, 0, 120), ex('crunch', 2, 10, 15, 0, 60)] },
      { name: 'Dos', exercises: [ex('lat_pulldown', 1, 6, 8, 0, 180, 'Après 2 séries d’échauffement'), ex('barbell_row', 1, 6, 8, 0, 180), ex('db_row', 1, 6, 8, 0, 150), ex('cable_row', 1, 8, 10, 0, 150), ex('back_extension', 1, 10, 12, 0, 120), ex('deadlift', 1, 6, 8, 0, 240, 'Partiel aux genoux à l’origine')] },
      { name: 'Pecs, biceps, abdos', exercises: [ex('incline_bench', 1, 6, 8, 0, 180, 'Après 2 séries d’échauffement'), ex('bench', 1, 6, 8, 0, 180), ex('pec_deck', 1, 8, 10, 0, 120), ex('db_curl', 1, 8, 10, 0, 120), ex('preacher_curl', 1, 8, 10, 0, 120), ex('crunch', 2, 10, 15, 0, 60)] },
      { name: 'Jambes', exercises: [ex('leg_ext', 1, 10, 12, 0, 120, 'Après 2 séries d’échauffement'), ex('leg_press', 1, 8, 10, 0, 180), ex('hack_squat', 1, 8, 10, 0, 180), ex('leg_curl', 1, 8, 10, 0, 120), ex('rdl', 1, 8, 10, 0, 150), ex('calf_raise', 1, 10, 12, 0, 90)] },
    ],
  },

  // ——— Poids du corps ———
  {
    id: 'bwf_recommended_routine',
    name: 'Recommended Routine (poids du corps)',
    author: 'Inspiré de la routine de r/bodyweightfitness, fondée sur Overcoming Gravity (Steven Low)',
    description:
      'Full body au poids du corps, 3 fois par semaine, en 3 paires (tirage + jambes, dips + charnière, rowing + pompes) puis un trio de gainage. Il suffit d’une barre de traction et de barres parallèles (ou deux chaises).',
    level: ['beginner', 'intermediate'],
    goals: ['recomp', 'cut', 'strength'],
    daysPerWeek: 3,
    style: 'poids_du_corps',
    progression: 'Prendre la variante la plus dure faisable en 3×5 ; ajouter une répétition par séance jusqu’à 3×8, puis passer à la variante suivante (ex. pompes inclinées → pompes → pompes diamant → pompes archer). 90 s entre chaque exercice d’une paire.',
    evidence:
      'La progression par variantes remplace l’ajout de charge et fonctionne bien jusqu’à un niveau intermédiaire. Volume d’environ 9 séries par grand groupe et fréquence 3× : conforme aux repères pour débuter. Les jambes progressent moins vite qu’avec une barre.',
    sources: [
      { label: 'r/bodyweightfitness – Recommended Routine (wiki)', url: 'https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/' },
      { label: 'Boostcamp – r/bodyweightfitness Recommended Routine', url: 'https://www.boostcamp.app/r-bodyweightfitness/r-bodyweight-recommended-routine' },
    ],
    days: [
      {
        name: 'Full body',
        exercises: [
          ex('pullup', 3, 5, 8, 2, 90, 'Paire 1 – variante adaptée (négatives, australiennes…)'),
          ex('pistol_squat', 3, 5, 8, 2, 90, 'Paire 1 – assisté → bulgare → pistol'),
          ex('dips', 3, 5, 8, 2, 90, 'Paire 2 – appuis → négatives → dips'),
          ex('sl_rdl', 3, 5, 8, 2, 90, 'Paire 2'),
          ex('inverted_row', 3, 5, 8, 2, 90, 'Paire 3'),
          ex('pushup', 3, 5, 8, 2, 90, 'Paire 3 – inclinées → classiques → diamant'),
          ex('plank', 3, 20, 60, 1, 60, 'Trio gainage : anti-extension'),
          ex('side_plank', 3, 20, 45, 1, 60, 'Trio gainage : anti-rotation'),
          ex('superman', 3, 20, 45, 1, 60, 'Trio gainage : extension'),
        ],
      },
    ],
  },
];
