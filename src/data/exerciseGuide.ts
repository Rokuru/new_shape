/**
 * Fiches d'exercice : famille de mouvement (pour le schéma), matériel et consignes d'exécution.
 * Les consignes générales viennent de la famille de mouvement ; une consigne propre à l'exercice peut s'y ajouter.
 */

export type MovePattern =
  | 'squat'
  | 'hinge'
  | 'swing'
  | 'lunge'
  | 'bench'
  | 'pushup'
  | 'press'
  | 'vpull'
  | 'row'
  | 'curl'
  | 'pushdown'
  | 'overhead_ext'
  | 'raise'
  | 'fly'
  | 'calf'
  | 'leg_ext'
  | 'leg_curl'
  | 'bridge'
  | 'plank'
  | 'side_plank'
  | 'crunch'
  | 'leg_raise'
  | 'dip'
  | 'jacks'
  | 'run'
  | 'wall_sit'
  | 'getup'
  | 'clean'
  | 'superman';

export interface ExerciseGuide {
  pattern: MovePattern;
  gear: string;
  cue?: string;
}

const g = (pattern: MovePattern, gear: string, cue?: string): ExerciseGuide => ({ pattern, gear, cue });

export const GUIDES: Record<string, ExerciseGuide> = {
  squat: g('squat', 'Barre + rack à squat'),
  front_squat: g('squat', 'Barre + rack à squat', 'Barre posée sur l’avant des épaules, coudes hauts : le buste reste plus droit qu’au squat classique.'),
  goblet_squat: g('squat', 'Haltère ou kettlebell tenu contre la poitrine'),
  bw_squat: g('squat', 'Poids du corps'),
  hack_squat: g('squat', 'Machine hack squat', 'Dos plaqué contre le dossier, pieds au milieu de la plateforme.'),
  leg_press: g('squat', 'Machine presse à cuisses', 'Bas du dos collé au dossier : ne descends pas au point de l’enrouler.'),
  pistol_squat: g('squat', 'Poids du corps (appui sur un support si besoin)', 'Une seule jambe, l’autre tendue devant ; tiens un montant pour t’aider au début.'),
  deadlift: g('hinge', 'Barre + disques'),
  rdl: g('hinge', 'Barre ou haltères', 'Genoux légèrement fléchis et fixes : seules les hanches reculent, jusqu’à l’étirement des ischios.'),
  sl_rdl: g('hinge', 'Poids du corps ou haltère', 'Sur une jambe, l’autre part en arrière dans le prolongement du dos.'),
  back_extension: g('hinge', 'Banc à lombaires (45°)', 'Hanches sur le coussin, descends en arrondissant à peine puis remonte jusqu’à l’alignement, sans cambrer.'),
  good_morning: g('hinge', 'Barre'),
  kb_swing: g('swing', 'Kettlebell (ou haltère)'),
  power_clean: g('clean', 'Barre + disques'),
  kb_clean: g('clean', 'Kettlebell(s)'),
  turkish_getup: g('getup', 'Kettlebell (ou haltère)'),
  lunge: g('lunge', 'Poids du corps ou haltères'),
  bulgarian_split: g('lunge', 'Banc + haltères', 'Pied arrière posé sur un banc, le poids sur la jambe avant.'),
  step_up: g('lunge', 'Banc ou box (haltères en option)', 'Monte en poussant sur le talon de la jambe posée sur le banc, sans t’élancer avec l’autre.'),
  leg_ext: g('leg_ext', 'Machine leg extension'),
  leg_curl: g('leg_curl', 'Machine leg curl'),
  nordic: g('leg_curl', 'Poids du corps (pieds bloqués)', 'À genoux, chevilles bloquées : descends le plus lentement possible en gardant hanches et buste alignés.'),
  hip_thrust: g('bridge', 'Banc + barre (coussin sur les hanches)', 'Haut du dos sur le banc, menton rentré, verrouille les fessiers en haut.'),
  glute_bridge: g('bridge', 'Au sol, poids du corps ou charge'),
  calf_raise: g('calf', 'Machine, marche ou haltère'),
  seated_calf: g('calf', 'Machine mollets assis', 'Genoux fléchis à 90° : cible le soléaire.'),
  wall_sit: g('wall_sit', 'Un mur'),
  bench: g('bench', 'Barre + banc + rack'),
  incline_bench: g('bench', 'Barre + banc incliné (30–45°)'),
  close_grip_bench: g('bench', 'Barre + banc', 'Mains à largeur d’épaules, coudes le long du corps : cible les triceps.'),
  db_bench: g('bench', 'Haltères + banc'),
  incline_db: g('bench', 'Haltères + banc incliné (30–45°)'),
  pushup: g('pushup', 'Poids du corps'),
  diamond_pushup: g('pushup', 'Poids du corps', 'Mains rapprochées sous la poitrine (index et pouces qui se touchent).'),
  pike_pushup: g('pushup', 'Poids du corps', 'Hanches hautes en V inversé : la tête descend vers le sol entre les mains.'),
  pushup_rotation: g('pushup', 'Poids du corps', 'En haut de chaque pompe, pivote en gainage latéral en levant un bras vers le plafond.'),
  dips: g('dip', 'Barres parallèles'),
  bench_dip: g('dip', 'Chaise ou banc', 'Mains sur le bord du banc derrière toi, descends jusqu’à 90° aux coudes.'),
  pec_deck: g('fly', 'Machine pec deck'),
  cable_fly: g('fly', 'Poulies hautes ou moyennes'),
  db_fly: g('fly', 'Haltères + banc', 'Allongé sur le banc, bras légèrement fléchis, ouvre jusqu’à l’étirement des pectoraux.'),
  ohp: g('press', 'Barre (debout)'),
  db_ohp: g('press', 'Haltères (assis ou debout)'),
  lateral_raise: g('raise', 'Haltères ou poulie basse'),
  rear_delt_fly: g('raise', 'Haltères (penché en avant)', 'Buste penché vers l’avant presque à l’horizontale : ouvre les bras sur les côtés, coudes légèrement fléchis.'),
  face_pull: g('row', 'Poulie haute + corde', 'Tire la corde vers le front en écartant les mains, coudes hauts.'),
  triceps_pushdown: g('pushdown', 'Poulie haute + barre ou corde'),
  overhead_ext: g('overhead_ext', 'Haltère ou poulie'),
  skull_crusher: g('overhead_ext', 'Barre EZ ou haltères + banc', 'Allongé, descends la barre vers le front en gardant les coudes fixes, pointés vers le plafond.'),
  pullup: g('vpull', 'Barre de traction (prise en pronation)'),
  chinup: g('vpull', 'Barre de traction (prise en supination)'),
  lat_pulldown: g('vpull', 'Machine tirage vertical'),
  barbell_row: g('row', 'Barre'),
  db_row: g('row', 'Haltère + banc', 'Main et genou en appui sur le banc, tire l’haltère vers la hanche.'),
  cable_row: g('row', 'Poulie basse (assis)'),
  inverted_row: g('row', 'Barre basse ou table solide', 'Allongé sous la barre, corps gainé : tire la poitrine vers la barre.'),
  barbell_curl: g('curl', 'Barre droite ou EZ'),
  db_curl: g('curl', 'Haltères + banc incliné', 'Allongé sur un banc incliné, bras pendants derrière le buste : étirement maximal du biceps.'),
  preacher_curl: g('curl', 'Pupitre + barre EZ ou haltère'),
  hammer_curl: g('curl', 'Haltères (prise neutre, pouces en haut)'),
  cable_crunch: g('crunch', 'Poulie haute + corde', 'À genoux, enroule le buste vers le bas en gardant les hanches fixes.'),
  crunch: g('crunch', 'Au sol'),
  hanging_leg_raise: g('leg_raise', 'Barre de traction'),
  plank: g('plank', 'Au sol'),
  side_plank: g('side_plank', 'Au sol'),
  superman: g('superman', 'Au sol'),
  jumping_jacks: g('jacks', 'Poids du corps'),
  high_knees: g('run', 'Poids du corps'),
};

export const PATTERN_LABELS: Record<MovePattern, string> = {
  squat: 'Squat',
  hinge: 'Charnière de hanche',
  swing: 'Swing',
  lunge: 'Fente',
  bench: 'Développé allongé',
  pushup: 'Pompe',
  press: 'Développé vertical',
  vpull: 'Tirage vertical',
  row: 'Tirage horizontal',
  curl: 'Flexion du coude',
  pushdown: 'Extension du coude',
  overhead_ext: 'Extension au-dessus de la tête',
  raise: 'Élévation',
  fly: 'Écarté',
  calf: 'Extension de cheville',
  leg_ext: 'Extension du genou',
  leg_curl: 'Flexion du genou',
  bridge: 'Extension de hanche',
  plank: 'Gainage',
  side_plank: 'Gainage latéral',
  crunch: 'Enroulement du buste',
  leg_raise: 'Relevé de jambes',
  dip: 'Dips',
  jacks: 'Cardio',
  run: 'Cardio',
  wall_sit: 'Isométrie',
  getup: 'Relevé complet',
  clean: 'Épaulé',
  superman: 'Extension du dos',
};

/** Consignes de base par famille de mouvement : position, exécution, point de vigilance. */
export const PATTERN_STEPS: Record<MovePattern, string[]> = {
  squat: ['Pieds largeur d’épaules, pointes légèrement ouvertes, gainage avant de descendre.', 'Descends en poussant les hanches en arrière et les genoux dans l’axe des pieds, au moins jusqu’à la parallèle.', 'Remonte en poussant le sol, talons au sol, dos neutre du début à la fin.'],
  hinge: ['Charge près des tibias, pieds largeur de hanches, dos plat et épaules au-dessus de la barre.', 'Pousse le sol avec les jambes puis ouvre les hanches : la barre frôle les jambes.', 'Debout, serre les fessiers sans te pencher en arrière ; redescends en reculant les hanches.'],
  swing: ['Kettlebell un peu devant toi, dos plat, saisis-la et lance-la entre les cuisses.', 'Extension explosive des hanches : la kettlebell monte à hauteur de poitrine, bras relâchés.', 'Laisse-la redescendre et recule les hanches au dernier moment ; ce n’est pas un squat.'],
  lunge: ['Debout, buste droit, regard devant.', 'Fais un grand pas et descends jusqu’à ce que le genou arrière frôle le sol.', 'Remonte en poussant sur le talon avant ; genou avant dans l’axe du pied.'],
  bench: ['Allongé, yeux sous la barre, omoplates serrées, pieds bien ancrés au sol.', 'Descends la charge contrôlée vers le bas des pectoraux, coudes à ~45° du buste.', 'Pousse jusqu’à bras tendus sans décoller les fesses du banc.'],
  pushup: ['Mains un peu plus larges que les épaules, corps gainé de la tête aux pieds.', 'Descends la poitrine près du sol, coudes à ~45° du buste.', 'Remonte bras tendus sans creuser le dos ; sur les genoux pour débuter.'],
  press: ['Debout (ou assis), charge au niveau des épaules, gainage et fessiers serrés.', 'Pousse à la verticale en passant la tête légèrement en arrière, puis dessous la charge.', 'Bras tendus au-dessus de la tête, sans cambrer ; redescends contrôlé.'],
  vpull: ['Prise un peu plus large que les épaules, bras tendus, épaules engagées vers le bas.', 'Tire les coudes vers les hanches jusqu’à ce que le menton passe la barre.', 'Redescends lentement jusqu’à bras tendus, sans balancer.'],
  row: ['Buste penché (ou assis bien droit), dos plat, bras tendus.', 'Tire la charge vers le bas du ventre en rapprochant les omoplates.', 'Marque une courte pause puis tends les bras sans arrondir le dos.'],
  curl: ['Debout, coudes collés au buste, prise en supination (paumes vers le haut).', 'Fléchis les coudes sans les avancer ni balancer le buste.', 'Redescends lentement jusqu’à bras tendus.'],
  pushdown: ['Face à la poulie haute, coudes collés au buste, avant-bras à l’horizontale.', 'Tends les bras vers le bas en gardant les coudes fixes.', 'Remonte contrôlé jusqu’à l’horizontale.'],
  overhead_ext: ['Charge tenue au-dessus de la tête, coudes pointés vers le haut.', 'Descends la charge derrière la tête en gardant les coudes fixes.', 'Tends les bras ; c’est la position étirée qui fait travailler le chef long du triceps.'],
  raise: ['Debout, haltères le long du corps, buste légèrement penché, coudes à peine fléchis.', 'Monte les bras sur les côtés jusqu’à l’horizontale, en menant avec les coudes.', 'Redescends lentement, sans élan ni haussement d’épaules.'],
  fly: ['Bras ouverts, coudes légèrement fléchis et fixes, poitrine sortie.', 'Ramène les mains l’une vers l’autre en arc de cercle, comme pour enlacer un tronc.', 'Rouvre lentement jusqu’à l’étirement des pectoraux.'],
  calf: ['Avant des pieds sur une marche ou la plateforme, talons dans le vide.', 'Monte le plus haut possible sur la pointe des pieds, marque 1 s en haut.', 'Descends lentement jusqu’à l’étirement complet.'],
  leg_ext: ['Assis, dos contre le dossier, genoux alignés avec l’axe de la machine.', 'Tends les jambes complètement, contracte les quadriceps 1 s.', 'Redescends lentement.'],
  leg_curl: ['Bien calé dans la machine, genoux alignés avec l’axe.', 'Fléchis les genoux en ramenant les talons vers les fesses.', 'Reviens lentement jusqu’à l’extension.'],
  bridge: ['Haut du dos (ou dos) au sol, pieds à plat, genoux à 90° en haut du mouvement.', 'Pousse dans les talons et monte les hanches jusqu’à l’alignement genoux–hanches–épaules.', 'Serre les fessiers 1 s en haut, sans cambrer le bas du dos.'],
  plank: ['Avant-bras au sol, coudes sous les épaules.', 'Corps aligné de la tête aux talons : fessiers et abdos contractés.', 'Respire normalement, ne laisse pas tomber les hanches.'],
  side_plank: ['Sur le côté, coude sous l’épaule, pieds superposés.', 'Monte les hanches pour aligner tête, bassin et pieds.', 'Tiens sans laisser descendre le bassin, puis change de côté.'],
  crunch: ['Allongé, genoux fléchis, mains aux tempes ou croisées sur la poitrine.', 'Enroule le haut du dos en rapprochant les côtes du bassin.', 'Redescends lentement sans tirer sur la nuque.'],
  leg_raise: ['Suspendu à la barre, bras tendus, corps immobile.', 'Monte les jambes (pliées pour débuter) en enroulant le bassin vers l’avant.', 'Redescends lentement sans balancer.'],
  dip: ['En appui bras tendus, épaules basses.', 'Descends jusqu’à ce que les coudes forment un angle de 90°, buste légèrement penché.', 'Remonte en poussant jusqu’à bras tendus.'],
  jacks: ['Debout, pieds joints, bras le long du corps.', 'Saute en écartant les pieds et en levant les bras au-dessus de la tête.', 'Reviens en position de départ et enchaîne sur un rythme rapide.'],
  run: ['Debout, buste droit, bras fléchis à 90°.', 'Monte un genou à hauteur de hanche, puis l’autre, sur la pointe des pieds.', 'Garde un rythme rapide en coordonnant les bras.'],
  wall_sit: ['Dos plaqué contre un mur.', 'Descends jusqu’à avoir les genoux à 90°, cuisses parallèles au sol.', 'Tiens la position en respirant, poids sur les talons.'],
  getup: ['Allongé, une kettlebell tenue bras tendu à la verticale, jambe du même côté pliée.', 'Monte sur le coude puis la main, lève les hanches, passe la jambe dessous et mets-toi à genou.', 'Relève-toi, puis refais le chemin inverse ; le bras reste vertical, regard sur la charge.'],
  clean: ['Charge devant toi, dos plat, comme au départ d’un soulevé de terre.', 'Extension explosive des hanches, puis passe les coudes dessous pour recevoir la charge sur les épaules.', 'Réception jambes légèrement fléchies, coudes devant.'],
  superman: ['Allongé sur le ventre, bras tendus devant.', 'Décolle bras, buste et jambes du sol en contractant le dos et les fessiers.', 'Tiens la position, regard vers le sol.'],
};

export const guideFor = (id: string): ExerciseGuide => GUIDES[id] ?? { pattern: 'plank', gear: '—' };
