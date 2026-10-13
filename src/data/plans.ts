/**
 * Plans objectifs : programmes en plusieurs phases sur plusieurs mois, avec cardio, règles et suivi.
 * Aucune donnée personnelle ici (le dépôt est public) : poids, masse grasse, calories et dates
 * sont calculés dans l'app à partir du profil et de la date de départ choisie.
 */
import type { Equipment, Goal, Level, PlannedExercise, ProgramDay } from '../lib/types';

export interface PlanTable {
  head: string[];
  rows: string[][];
}

/** Bloc de texte : `**gras**` est rendu en gras, rien d'autre n'est interprété. */
export interface PlanSection {
  title: string;
  intro?: string;
  bullets?: string[];
  steps?: string[];
  outro?: string;
}

export interface PlanPhase {
  id: string;
  name: string;
  /** Semaines couvertes, de 1 à `weeks` du plan. */
  weeks: [number, number];
  summary: string;
  bullets: string[];
  rotation: string;
  /** Séries plafonnées certaines semaines (ex. 2 séries en S1–S2). */
  capSets?: { weeks: [number, number]; sets: number };
  /** Semaine allégée : une série de moins partout et charges −10 %. */
  deloadWeek?: number;
  cardio: { walk: string; steps: string; stepsTarget: number; intervals: string };
  days: ProgramDay[];
}

export interface PlanTemplate {
  id: string;
  name: string;
  summary: string;
  weeks: number;
  /** Réglages du profil appliqués avec le plan. */
  profile: { goal: Goal; level: Level; equipment: Equipment; daysPerWeek: number; sessionMinutes: number };
  /** % de masse grasse visé proposé par défaut. */
  defaultBodyFatPct: { male: number; female: number };
  frame: string;
  books: string;
  overview: string;
  weekType: PlanTable;
  /** Jours des séances de la semaine type (1re, 2e, 3e séance). */
  sessionDays: string[];
  phases: PlanPhase[];
  cardioIntro: string;
  cardioBullets: string[];
  rulesIntro: string;
  rules: PlanSection[];
  machinesIntro: string;
  machines: PlanTable;
  measures: string[];
  adjustments: string[];
  /** Exercices suivis dans le tableau mensuel. */
  tracked: { id: string; label: string }[];
  sources: string[];
}

/** Exercice prévu : séries, répétitions (nombre ou fourchette), repos (s), RIR, consigne. */
function ex(exerciseId: string, sets: number, reps: number | [number, number], restSec: number, rir: number, note?: string): PlannedExercise {
  const [repMin, repMax] = typeof reps === 'number' ? [reps, reps] : reps;
  return note ? { exerciseId, sets, repMin, repMax, restSec, rir, note } : { exerciseId, sets, repMin, repMax, restSec, rir };
}

const WALK_AFTER = 'Après la séance : 10–15 min de marche inclinée.';

export const BASICFIT_CUT: PlanTemplate = {
  id: 'basicfit_cut_34w',
  name: 'Basic-Fit : sèche en 4 phases (8 mois)',
  summary: 'Trois séances de 60 min par semaine dans un Basic-Fit, niveau débutant, plus la marche inclinée : machines guidées, puis charges lourdes, puis densité en fin de sèche.',
  weeks: 34,
  profile: { goal: 'cut', level: 'beginner', equipment: 'full_gym', daysPerWeek: 3, sessionMinutes: 60 },
  defaultBodyFatPct: { male: 20, female: 28 },
  frame: '3 séances de 60 min par semaine dans un Basic-Fit, niveau débutant (moins d’un an de musculation), plus la marche.',
  books:
    '**Les livres.** Aucun des deux ne contient de programme pour débutant en perte de poids. Le tome 1 de la Bible de la musculation au poids de corps est un catalogue de 480 exercices (les programmes sont dans le tome 2). La Méthode Delavier vol. 3 vise les pratiquants avancés. Le plan en reprend les principes (échauffement, repos, sèche, protection des genoux, du dos et des épaules) et les exercices adaptés au niveau débutant. Les pages sont citées à chaque emprunt.',
  overview: 'On passe de machines légères à des charges lourdes, puis à la densité en fin de sèche. Les semaines allégées tombent aux charnières S14 et S24.',
  weekType: {
    head: ['Jour', 'Phases 1–2', 'Phases 3–4'],
    rows: [
      ['Lundi', '1re séance de la semaine + 10–15 min de marche inclinée', 'Séance Haut'],
      ['Mardi', 'Marche inclinée', 'Marche inclinée (ou 4e séance optionnelle)'],
      ['Mercredi', '2e séance de la semaine', 'Séance Bas'],
      ['Jeudi', 'Marche inclinée', 'Marche inclinée (+ intervalles vélo en phase 4)'],
      ['Vendredi', '3e séance de la semaine', 'Séance métabolique ou congestion'],
      ['Samedi', 'Marche longue ou sport', 'Marche longue ou sport'],
      ['Dimanche', 'Repos, juste les pas du jour', 'Repos, juste les pas du jour'],
    ],
  },
  sessionDays: ['lundi', 'mercredi', 'vendredi'],
  phases: [
    {
      id: 'p1',
      name: 'Fondations',
      weeks: [1, 6],
      summary: 'Tout se fait sur machines guidées, en alternant A-B-A une semaine puis B-A-B la suivante. Le but : apprendre les gestes et préparer tendons et articulations avant de charger.',
      bullets: [
        '**Séries.** 2 séries en S1–S2, puis 3 séries de S3 à S6 : l’app ajuste toute seule.',
        '**Intensité.** Arrête chaque série quand il te reste 2 à 3 répétitions possibles.',
        '**Tempo.** Descente contrôlée en 2–3 s, montée franche.',
        '**Échauffement.** 10 min avant chaque séance (voir « Règles »).',
      ],
      rotation: 'A-B-A une semaine, B-A-B la suivante',
      capSets: { weeks: [1, 2], sets: 2 },
      cardio: { walk: '3 × 30–40 min, 4 km/h, 4–6 %', steps: '8 000', stepsTarget: 8000, intervals: '—' },
      days: [
        {
          name: 'Séance A',
          note: WALK_AFTER,
          exercises: [
            ex('leg_press', 3, [12, 15], 90, 2, 'Pieds largeur de hanches, le bas du dos ne décolle pas.'),
            ex('m_chest_press', 3, [12, 15], 90, 2, 'Omoplates serrées, coudes sous les poignées.'),
            ex('lat_pulldown', 3, [12, 15], 90, 2, 'Barre jusqu’au haut de la poitrine, buste fixe.'),
            ex('leg_curl', 2, [12, 15], 60, 2, 'Descente lente.'),
            ex('lateral_raise', 2, 15, 60, 2, 'Haltères légers, bras sous l’horizontale.'),
            ex('plank', 3, [20, 30], 45, 2, 'Secondes. Fessiers serrés, dos plat, sur les genoux si besoin (Bible p. 366).'),
          ],
        },
        {
          name: 'Séance B',
          note: WALK_AFTER,
          exercises: [
            ex('box_squat', 3, [10, 12], 90, 2, 'Haltère contre la poitrine : s’asseoir sur le banc puis repartir (Bible p. 199).'),
            ex('m_seated_row', 3, [12, 15], 90, 2, 'Tirer avec les coudes, poitrine sortie.'),
            ex('pec_deck', 2, 15, 60, 2, 'Pas d’étirement extrême en arrière.'),
            ex('hip_thrust', 3, 15, 60, 2, 'Au banc, poids de corps : contracter les fessiers 1 s en haut, sans creuser le dos (Bible p. 341).'),
            ex('leg_ext', 2, 15, 60, 2, 'Charge légère, sans à-coups.'),
            ex('cable_curl', 2, 15, 10, 2, 'Enchaîné avec l’extension triceps poulie haute, coudes fixes.'),
            ex('triceps_pushdown', 2, 15, 60, 2, 'Juste après le curl ; 60 s de repos après le duo.'),
            ex('side_plank', 2, 20, 30, 2, 'Secondes par côté. Bassin aligné (Bible p. 387).'),
          ],
        },
      ],
    },
    {
      id: 'p2',
      name: 'Full body renforcé',
      weeks: [7, 14],
      summary: 'Trois séances différentes (A, B, C), toujours en full body. Les charges montent et les premiers poids libres arrivent.',
      bullets: [
        '**Volume.** 3–4 séries de 8–12 reps. Arrête quand il te reste 1 à 2 reps possibles.',
        '**Repos.** 2 min sur les exercices de base, 60–90 s sur l’isolation.',
        '**Semaine allégée S14.** Mêmes exercices, une série de moins partout et charges −10 % : l’app l’applique toute seule.',
        '**Fêtes.** Si tu sautes une séance, décale-la sans la doubler.',
      ],
      rotation: 'A-B-C, puis on recommence',
      deloadWeek: 14,
      cardio: { walk: '3–4 × 40 min, 4,5 km/h, 6–8 %', steps: '9 000', stepsTarget: 9000, intervals: '—' },
      days: [
        {
          name: 'Séance A – poussée et quadriceps',
          exercises: [
            ex('leg_press', 4, [8, 12], 120, 1),
            ex('db_bench', 4, [8, 12], 120, 1, 'Ou Smith machine.'),
            ex('lat_pulldown', 3, [10, 12], 90, 1, 'Prise serrée neutre.'),
            ex('reverse_lunge', 3, 10, 90, 1, 'Par jambe, haltères en main (Back Lunge, Bible p. 232).'),
            ex('lateral_raise', 3, [12, 15], 60, 1),
            ex('triceps_pushdown', 2, [12, 15], 60, 1),
            ex('m_ab_crunch', 3, [15, 20], 45, 1),
          ],
        },
        {
          name: 'Séance B – tirage et chaîne postérieure',
          exercises: [
            ex('rdl', 4, 10, 120, 1, 'Haltères, dos plat, genoux légèrement fléchis.'),
            ex('m_seated_row', 4, [8, 12], 120, 1),
            ex('m_chest_press', 3, [10, 12], 90, 1),
            ex('hip_thrust', 3, [10, 12], 90, 1, 'Au banc, avec haltère ou barre (Bible p. 341).'),
            ex('m_rear_delt', 3, 15, 60, 1),
            ex('standing_db_curl', 2, 12, 60, 1),
            ex('plank', 3, 40, 45, 1, 'Secondes (Bible p. 366).'),
          ],
        },
        {
          name: 'Séance C – full body et densité',
          note: 'Pour finir : rameur 6 × (30 s soutenu / 30 s lent), soit 6 min.',
          exercises: [
            ex('goblet_squat', 4, [10, 12], 90, 1, 'Ou hack squat si ton club en a un.'),
            ex('lat_pulldown', 3, [8, 10], 90, 1, 'Ou tractions assistées à la machine.'),
            ex('incline_db', 3, [10, 12], 90, 1, 'Banc à 30°.'),
            ex('leg_curl', 3, 12, 60, 1),
            ex('step_up', 2, 10, 60, 1, 'Par jambe, sur un banc bas (Bible p. 244).'),
          ],
        },
      ],
    },
    {
      id: 'p3',
      name: 'Haut / Bas + métabolique',
      weeks: [15, 24],
      summary: 'Une séance lourde pour le haut, une lourde pour le bas, et une séance métabolique à repos courts. Les deux premières gardent le muscle, la troisième augmente la dépense.',
      bullets: [
        '**Séances lourdes.** 6–10 reps sur les exercices de base, 2 min de repos (3 min si besoin).',
        '**Séance métabolique.** Selon Delavier, raccourcir les repos est moins traumatisant que de charger lourd, à condition de baisser les charges de 10 à 15 % (vol. 3, p. 57).',
        '**Option 4e séance.** Si tu as le temps : 45 min de marche inclinée + 10 min de gainage.',
        '**Semaine allégée S24.** Une série de moins partout, charges −10 % : l’app l’applique toute seule.',
      ],
      rotation: 'Haut, Bas, Métabolique',
      deloadWeek: 24,
      cardio: { walk: '4 × 40–45 min, 5 km/h, 8–10 %', steps: '10 000', stepsTarget: 10000, intervals: '1×/sem., vélo' },
      days: [
        {
          name: 'Séance Haut',
          exercises: [
            ex('db_bench', 4, [6, 10], 120, 1, 'Haltères ou Smith machine.'),
            ex('db_row', 4, [8, 10], 120, 1, 'Ou rowing assis machine.'),
            ex('lat_pulldown', 3, [8, 12], 90, 1),
            ex('m_incline_press', 3, [10, 12], 90, 1),
            ex('lateral_raise', 3, [12, 15], 10, 1, 'Enchaîné avec l’oiseau.'),
            ex('m_rear_delt', 3, [12, 15], 60, 1, '60 s de repos après le duo.'),
            ex('cable_curl', 3, 12, 10, 1, 'Enchaîné avec l’extension triceps.'),
            ex('triceps_pushdown', 3, 12, 60, 1, '60 s de repos après le duo.'),
          ],
        },
        {
          name: 'Séance Bas',
          exercises: [
            ex('m_smith_squat', 4, [6, 10], 150, 1, 'Ou hack squat ; 2–3 min de repos.'),
            ex('rdl', 3, [8, 10], 120, 1, 'Haltères ou barre.'),
            ex('leg_press', 3, 12, 90, 1, 'Pieds hauts sur la plateforme.'),
            ex('leg_curl', 3, [10, 12], 60, 1),
            ex('m_standing_calf', 3, 15, 45, 1, 'Ou mollets à la presse.'),
            ex('m_ab_crunch', 3, [12, 15], 45, 1, 'Ou relevés de genoux à la chaise romaine.'),
          ],
        },
        {
          name: 'Séance métabolique',
          note: 'Circuit dans la zone fonctionnelle (une paire d’haltères et un banc) : enchaîne les 5 exercices sans pause, 4 tours, 2 min de repos entre les tours. Ensuite 15 min de vélo en intervalles : 8 × (30 s fort / 90 s facile).',
          exercises: [
            ex('goblet_squat', 4, 12, 0, 2),
            ex('incline_pushup', 4, [10, 12], 0, 2, 'Mains sur un banc (version facilitée du Push Up, Bible p. 19).'),
            ex('db_row', 4, 12, 0, 2, 'Par bras.'),
            ex('reverse_lunge', 4, 10, 0, 2, 'Par jambe (Bible p. 232).'),
            ex('plank', 4, 30, 120, 2, 'Secondes (Bible p. 366). Fin du tour : 2 min de repos.'),
          ],
        },
      ],
    },
    {
      id: 'p4',
      name: 'Sèche finale',
      weeks: [25, 34],
      summary: 'Les charges lourdes restent : c’est ce qui dit au corps de garder le muscle quand le déficit dure depuis des mois. La dépense monte par la densité (enchaînements) et par la marche, pas par plus de séries.',
      bullets: [
        '**Alterner lourd et congestion** (Delavier vol. 3, p. 69) : deux séances lourdes, une séance légère à repos courts.',
        '**Post-fatigue des cuisses** (p. 187) : après la presse, enchaîne tout de suite une série de leg extension, car les quadriceps ont encore de la force inexploitée.',
        '**Repos courts, charges −10 à 15 %** (p. 57), sur la séance congestion.',
        '**Abdos en séries longues** (p. 174–175) : remplace 5 min de cardio par 5 min de crunchs presque sans pause (15–20 s entre les séries), puis augmente peu à peu. Pour Delavier, cela brûle des calories sans faire fondre les cuisses comme trop de cardio. C’est une option, pas un brûleur de graisse du ventre.',
        '**Fatigue.** Si elle s’accumule (sommeil, charges en baisse 2 séances de suite), retire une série par exercice, sans baisser les charges.',
        '**S34 : bilan.** Mesures, photos, test des charges clés.',
      ],
      rotation: 'Haut lourd, Bas lourd, Congestion',
      cardio: { walk: '4–5 × 45 min, 5 km/h, 10–12 %', steps: '10 000–12 000', stepsTarget: 11000, intervals: '1–2×/sem., vélo ou rameur' },
      days: [
        {
          name: 'Séance Haut lourd',
          exercises: [
            ex('db_bench', 4, [5, 8], 150, 1, 'Smith machine ou haltères.'),
            ex('lat_pulldown', 4, [6, 8], 120, 1, 'Ou tractions assistées.'),
            ex('m_seated_row', 3, 10, 10, 1, 'Enchaîné avec la chest press.'),
            ex('m_chest_press', 3, 10, 90, 1, '90 s de repos après le duo.'),
            ex('lateral_raise', 3, 15, 10, 1, 'Enchaîné avec l’oiseau.'),
            ex('m_rear_delt', 3, 15, 60, 1, '60 s de repos après le duo.'),
            ex('cable_curl', 2, [12, 15], 10, 1, 'Enchaîné avec l’extension triceps.'),
            ex('triceps_pushdown', 2, [12, 15], 60, 1, '60 s de repos après le duo.'),
          ],
        },
        {
          name: 'Séance Bas lourd',
          exercises: [
            ex('m_smith_squat', 4, [5, 8], 150, 1, 'Ou hack squat ; 2–3 min de repos.'),
            ex('leg_press', 3, 10, 10, 1, 'Post-fatigue : enchaîne tout de suite la leg extension (Delavier vol. 3, p. 187).'),
            ex('leg_ext', 3, 15, 120, 1, '2 min de repos après le duo.'),
            ex('rdl', 3, 8, 120, 1),
            ex('leg_curl', 3, 12, 60, 1),
            ex('crunch', 5, [15, 25], 20, 1, 'Séries longues : 5 min de crunchs presque sans pause, 15–20 s entre les séries (Delavier vol. 3, p. 174–175).'),
          ],
        },
        {
          name: 'Séance congestion',
          note: 'Circuit machines : 3 tours, 15 reps par exercice, 45 s entre les exercices, charges −10 à 15 %. Va-y en heure creuse pour trouver les machines libres. Termine par 20 min de marche inclinée.',
          exercises: [
            ex('leg_press', 3, 15, 45, 2),
            ex('m_chest_press', 3, 15, 45, 2),
            ex('lat_pulldown', 3, 15, 45, 2),
            ex('leg_curl', 3, 15, 45, 2),
            ex('m_incline_press', 3, 15, 45, 2),
            ex('m_seated_row', 3, 15, 45, 2),
            ex('lateral_raise', 3, 15, 45, 2),
            ex('hip_thrust', 3, 15, 45, 2, 'Au banc.'),
          ],
        },
      ],
    },
  ],
  cardioIntro: 'La marche inclinée reste ton premier outil de dépense. En montant vitesse et pente, tu peux dépenser autant en 40 min qu’en plus d’une heure et demie de marche lente.',
  cardioBullets: [
    'Sans te tenir aux barres du tapis : sinon la dépense chute.',
    'Pas de course nécessaire. À un poids élevé, elle charge genoux et chevilles pour un gain faible face à la marche en pente.',
    'Intervalles plafonnés à 2 par semaine, et jamais la veille de la séance jambes. Delavier prévient que trop de cardio fait fondre les quadriceps et fatigue genoux et hanches (vol. 3, p. 174).',
    'Les pas comptent autant que la salle : escaliers, trajets à pied, appels en marchant.',
  ],
  rulesIntro: 'Trois règles comptent plus que tout le reste : s’échauffer à chaque séance, monter les charges par petits pas, et contrôler la descente.',
  rules: [
    {
      title: 'Échauffement (10 min, d’après Delavier vol. 3, p. 39 et 235–237)',
      steps: [
        '**Général.** Une série longue de crunchs + une planche de 30 s. Delavier les préfère au cardio pour chauffer le corps vite ; 5 min de vélo font aussi l’affaire.',
        '**Épaules.** 20–30 rotations internes puis externes avec un élastique.',
        '**Cycle de chauffe sans repos**, 20–30 reps faciles avec un disque de quelques kilos. Jour haut du corps : curl, élévations latérales, élévations frontales, rowing debout, soulevé de terre jambes tendues, extension triceps poulie haute, élévations latérales penché. Jour bas du corps : mollets, squat, soulevé de terre jambes tendues, adducteurs à la machine. Jour full body : le cycle bas + curl, élévations latérales et rowing debout.',
        '**Spécifique.** 1 à 2 séries légères du premier exercice.',
      ],
      outro: 'En régime hypocalorique, la température du corps baisse légèrement et le risque de blessure monte (p. 40). Ne saute jamais l’échauffement, et garde épaules ou genoux couverts entre les séries.',
    },
    {
      title: 'Progression',
      bullets: [
        '**Double progression.** Reste sur la même charge jusqu’à faire le haut de la fourchette sur toutes les séries, avec une technique propre. Ajoute alors +2,5 à 5 kg (machine) ou +1 à 2 kg par haltère, et repars du bas de la fourchette.',
        '**Note tout** (charges, reps, ressenti) dans New Shape, séance par séance.',
        '**Repos raccourci = charge baissée** de 10 à 15 % pour garder le même nombre de reps (Delavier, p. 57).',
        '**Règle des 3 P** de la Bible (p. 476) : progressivité, patience, précision.',
      ],
    },
    {
      title: 'Technique et sécurité',
      bullets: [
        '**Descente en 2–3 s.** La phase négative est la plus risquée pour muscles et tendons (Delavier, p. 49).',
        '**Amplitude complète, sans étirement extrême.** Par exemple, pas besoin de tendre le bras à fond en bas du curl (p. 48), ni de monter le menton très haut au-dessus de la barre aux tractions (p. 49).',
        '**Épaules.** Évite les charges lourdes bras au-dessus de la tête, principale cause d’accrochage (p. 91). C’est pourquoi le programme n’a pas de développé militaire lourd.',
        '**Genoux douloureux** au squat ou à la presse : passe au leg extension et au relevé de genou à la poulie basse (p. 194).',
        '**Dos tassé** : la presse charge le dos plus qu’il n’y paraît. Préfère leg extension et fentes (p. 195).',
        '**Douleur articulaire vive** : on arrête l’exercice, pas la séance.',
      ],
    },
    {
      title: 'Récupération',
      bullets: ['7 à 9 h de sommeil.', 'Au moins 48 h entre deux séances lourdes sur les mêmes muscles.', 'Courbatures qui durent plus de 72 h : retire une série sur ces exercices la fois suivante.'],
    },
  ],
  machinesIntro:
    'Les clubs Basic-Fit sont équipés en machines Matrix, réparties en zones : cardio, machines guidées, poids libres, fonctionnel. Le parc exact varie d’un club à l’autre (hack squat, machine à hip thrust…) : repère le tien à la première séance.',
  machines: {
    head: ['Exercice du programme', 'Où chez Basic-Fit', 'Si la machine est prise ou absente'],
    rows: [
      ['Presse à cuisses', 'Machines guidées (leg press)', 'Hack squat, goblet squat'],
      ['Squat guidé', 'Smith machine ou hack squat', 'Goblet squat au banc'],
      ['Leg extension', 'Machines guidées', 'Split squat (Bible p. 242)'],
      ['Leg curl', 'Machines guidées (assis ou allongé)', 'Soulevé de terre roumain haltères'],
      ['Adducteurs (échauffement)', 'Adductor machine', 'Squat sumo léger'],
      ['Hip thrust', 'Banc + haltère ou barre, zone poids libres', 'Bridge Raise au sol (Bible p. 338)'],
      ['Chest press', 'Machines guidées', 'Développé couché haltères'],
      ['Développé incliné', 'Banc incliné + haltères, ou machine', 'Pompes mains surélevées (Bible p. 19)'],
      ['Pec deck et oiseau', 'Machine pec fly / rear delt', 'Poulies vis-à-vis ; oiseau haltères penché'],
      ['Tirage vertical', 'Lat pulldown', 'Tractions assistées, poulie haute un bras'],
      ['Rowing assis', 'Seated row', 'Rowing un bras haltère ; Inverted Row à la Smith (Bible p. 136)'],
      ['Biceps, triceps', 'Poulies, haltères', 'Haltères'],
      ['Crunch', 'Abdominal crunch ou tapis au sol', 'Planche, crunch au sol'],
      ['Cardio', 'Tapis, vélo, elliptique, rameur', 'Selon dispo, en gardant la même durée'],
    ],
  },
  measures: [
    '**Poids.** Pesée 3 fois par semaine, le matin à jeun. Seule la moyenne de la semaine compte.',
    '**Tour de taille.** Au nombril, une fois par mois.',
    '**Masse grasse.** Même appareil, mêmes conditions (une balance à impédance varie avec l’hydratation).',
  ],
  adjustments: [
    'Moins de 0,4 kg perdu par semaine, deux semaines de suite après le premier mois : −150 kcal/jour ou +2 000 pas/jour.',
    'Plus de 1,2 kg par semaine après le premier mois, ou charges en baisse deux séances de suite : +150 kcal/jour.',
    'Plateau de 2–3 semaines alors que le tour de taille baisse : c’est souvent de l’eau, on ne touche à rien.',
  ],
  tracked: [
    { id: 'leg_press', label: 'Presse' },
    { id: 'lat_pulldown', label: 'Tirage vertical' },
  ],
  sources: [
    'Frédéric Delavier et Michael Gundill, La Méthode Delavier de musculation, vol. 3, Vigot, 2018 — pages citées dans le texte.',
    'La Bible de la musculation au poids de corps, tome 1 : guide des mouvements, Amphora, 2018 — pages citées dans le texte.',
    'Basic-Fit, zones d’entraînement et équipement Matrix.',
    'Estimations : équation de marche de l’ACSM (dépense de la marche), formule de Mifflin-St Jeor (métabolisme de base), 7 700 kcal par kg de graisse.',
  ],
};

export const PLAN_TEMPLATES: PlanTemplate[] = [BASICFIT_CUT];
