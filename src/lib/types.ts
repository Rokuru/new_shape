export type Sex = 'male' | 'female';
export type Goal = 'cut' | 'recomp' | 'bulk' | 'strength';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'full_gym' | 'home_dumbbells' | 'bodyweight';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

export type SplitPref = 'auto' | 'full' | 'upper_lower' | 'ppl' | 'mix' | 'bro';

export interface Profile {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activity: ActivityLevel;
  goal: Goal;
  level: Level;
  equipment: Equipment;
  daysPerWeek: number;
  sessionMinutes: number;
  /** Muscles que l'utilisateur veut prioriser (volume supplémentaire). */
  priorities: Muscle[];
  /** Répartition voulue pour le programme généré (auto : selon le nombre de séances). */
  split?: SplitPref;
  /** Programme généré : machines guidées en priorité (salle complète). */
  preferMachines?: boolean;
  /** Formule du métabolisme de base choisie (auto par défaut). */
  bmrMethod?: BmrMethod;
  /** Poids visé (kg) et poids de tendance au moment où l'objectif a été fixé. */
  targetWeightKg?: number;
  targetStartKg?: number;
  targetSetAt?: string;
  /** % de masse grasse visé, et % mesuré au moment où cet objectif a été fixé. */
  targetBodyFatPct?: number;
  targetStartBfPct?: number;
}

export type BmrMethod = 'auto' | 'mifflin' | 'harris' | 'katch' | 'cunningham' | 'tinsley';

/** Segments mesurés par une balance impédancemètre segmentaire (Tanita BC-545N…). */
export type Segment = 'armR' | 'armL' | 'legR' | 'legL' | 'trunk';

/** Valeurs affichées par une balance à bio-impédance (BIA) type Tanita BC-545N. */
export interface BiaData {
  waterPct?: number;
  /** Masse musculaire (kg) : inclut l'eau des muscles, différente de la masse maigre. */
  muscleKg?: number;
  /** Indice de masse physique Tanita, 1 à 9. */
  physique?: number;
  boneKg?: number;
  /** Calories affichées par la balance (BMR ou apport conseillé selon le modèle). */
  kcal?: number;
  metabolicAge?: number;
  /** Indice de graisse viscérale Tanita, 1 à 59. */
  visceral?: number;
  segFat?: Partial<Record<Segment, number>>;
  segMuscle?: Partial<Record<Segment, number>>;
}

export interface BodyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  /** % de masse grasse saisi directement (balance, DEXA, pince...). */
  bodyFatPct?: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  note?: string;
  /** Mesure par bio-impédance ; si présent, bodyFatPct vient de la balance. */
  bia?: BiaData;
}

/**
 * Marche sur tapis : vitesse + durée + inclinaison (saisie principale),
 * ou nombre de pas pour ceux qui l'ont.
 */
export interface CardioEntry {
  id: string;
  date: string; // YYYY-MM-DD
  /** Inclinaison du tapis en %. */
  inclinePct: number;
  speedKmh?: number;
  durationMin?: number;
  steps?: number;
}

/** Calories mangées : une ligne par prise (repas, collation), saisie libre. */
export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD (jour local)
  /** Heure de saisie (ISO), pour l'ordre et l'affichage. */
  at: string;
  kcal: number;
  /** Protéines (g), facultatif. */
  proteinG?: number;
  label?: string;
}

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment[];
  kind: 'compound' | 'isolation';
  /** La charge saisie est un lest : la charge réelle inclut le poids du corps (tractions, dips). */
  bodyweight?: boolean;
  /** Incrément de charge conseillé en kg. */
  increment: number;
  tips?: string;
  /** Machine guidée de salle (Basic-Fit : Matrix ou Technogym). Le nom se termine par le nom anglais affiché sur la machine. */
  machine?: boolean;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** RIR cible (répétitions en réserve). */
  rir: number;
  restSec: number;
  note?: string;
}

export interface ProgramDay {
  name: string;
  exercises: PlannedExercise[];
  /** Étirements de fin de séance (identifiants de data/stretches) ; absent = suggestion automatique. */
  stretches?: string[];
}

export interface Program {
  id: string;
  name: string;
  author: string;
  description: string;
  level: Level[];
  goals: Goal[];
  daysPerWeek: number;
  progression: string;
  days: ProgramDay[];
  custom?: boolean;
  /** Programme créé par le générateur « sur mesure » (remplacé quand on en enregistre un nouveau) ; false une fois modifié à la main. */
  generated?: boolean;
  /** Famille de méthode, pour filtrer et comparer. */
  style?: ProgramStyle;
  /** Durée annoncée d'une séance (min), échauffement compris, quand l'estimation par séries ne convient pas (circuits). */
  durationMin?: number;
  /** Ce qu'en disent les études (points forts, limites). */
  evidence?: string;
  /** Sources consultées (auteur, synthèses, études). */
  sources?: ProgramSource[];
}

export type ProgramStyle = 'force' | 'powerbuilding' | 'hypertrophie' | 'haute_intensite' | 'poids_du_corps' | 'court';

export interface ProgramSource {
  label: string;
  url: string;
}

export interface LoggedSet {
  weight: number;
  reps: number;
  rir?: number;
  done: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  target?: PlannedExercise;
  sets: LoggedSet[];
}

export interface Workout {
  id: string;
  date: string; // ISO datetime
  programId?: string;
  dayName: string;
  exercises: LoggedExercise[];
  durationMin?: number;
  note?: string;
  finished: boolean;
  /** Étirements prévus pour la séance et ceux effectués. */
  stretches?: { id: string; done: boolean }[];
}
