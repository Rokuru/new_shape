import { getExercise, MUSCLES } from '../data/exercises';
import type { Equipment, Muscle, Profile, Program, ProgramStyle } from './types';
import { VOLUME_LANDMARKS, volumeFromSets } from './calc';

export const STYLE_LABELS: Record<ProgramStyle, string> = {
  force: 'Force',
  powerbuilding: 'Force + muscle',
  hypertrophie: 'Hypertrophie',
  haute_intensite: 'Haute intensité',
  poids_du_corps: 'Poids du corps',
  court: 'Séances courtes',
};

/** Une série compte comme « dure » si elle finit à 3 répétitions de l'échec ou moins (séries de vitesse, d'échauffement et de récupération exclues). */
const HARD_RIR = 3;

/** Grands groupes servant au calcul de la fréquence moyenne. */
const MAJOR: Muscle[] = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'];

export interface ProgramStats {
  /** Séries dures par semaine, tous exercices. */
  hardSets: number;
  /** Séries dures par muscle et par semaine (secondaire = ½). */
  perMuscle: Record<Muscle, number>;
  /** Nombre moyen de séances par semaine où chaque grand groupe est travaillé en principal. */
  frequency: number;
  /** Part des séries dures dans la zone lourde (≤ 6 répétitions). */
  heavyShare: number;
  /** Durée moyenne estimée d'une séance (min), échauffement compris. */
  minutes: number;
  /** Muscles sous le volume minimum efficace (MEV). */
  belowMev: Muscle[];
  /** Matériel suffisant pour faire tout le programme. */
  equipment: Equipment[];
}

export function programStats(p: Program): ProgramStats {
  // Les programmes en rotation (A/B sur 3 jours…) : on ramène à une semaine.
  const perWeek = p.daysPerWeek / p.days.length;
  const all = p.days.flatMap((d) => d.exercises);
  const hard = all.filter((e) => e.rir <= HARD_RIR);
  const hardSets = hard.reduce((s, e) => s + e.sets, 0) * perWeek;
  const raw = volumeFromSets(hard.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets })));
  const perMuscle = Object.fromEntries(MUSCLES.map((m) => [m, round1(raw[m] * perWeek)])) as Record<Muscle, number>;

  const sessionsPerMuscle = MAJOR.map((m) => p.days.filter((d) => d.exercises.some((e) => getExercise(e.exerciseId).primary.includes(m))).length * perWeek);
  const frequency = round1(sessionsPerMuscle.reduce((a, b) => a + b, 0) / MAJOR.length);

  const heavy = hard.filter((e) => e.repMax <= 6).reduce((s, e) => s + e.sets, 0);
  const heavyShare = hardSets ? (heavy * perWeek) / hardSets : 0;

  // ~40 s d'effort par série + repos prescrit, + 10 min d'échauffement.
  const dayMinutes = p.days.map((d) => 10 + d.exercises.reduce((s, e) => s + (e.sets * (40 + e.restSec)) / 60, 0));
  const minutes = p.durationMin ?? Math.round(dayMinutes.reduce((a, b) => a + b, 0) / p.days.length / 5) * 5;

  const belowMev = MUSCLES.filter((m) => VOLUME_LANDMARKS[m].mev > 0 && perMuscle[m] < VOLUME_LANDMARKS[m].mev);

  const equipment = (['full_gym', 'home_dumbbells', 'bodyweight'] as Equipment[]).filter((eq) => canDo(p, eq));
  return { hardSets: Math.round(hardSets), perMuscle, frequency, heavyShare, minutes, belowMev, equipment };
}

/** Le programme est faisable avec ce matériel (une salle complète permet tout). */
export function canDo(p: Program, equipment: Equipment): boolean {
  if (equipment === 'full_gym') return true;
  return p.days.every((d) => d.exercises.every((e) => getExercise(e.exerciseId).equipment.some((x) => x === equipment || (equipment === 'home_dumbbells' && x === 'bodyweight'))));
}

/** Adéquation au profil : niveau (2), matériel (2), objectif (1), nombre de séances (1), durée de séance (2 si séances courtes, sinon 1). */
export function programScore(p: Program, profile: Profile): number {
  const minutes = programStats(p).minutes;
  const fitsTime = minutes <= profile.sessionMinutes + 10;
  const timeScore = fitsTime ? (profile.sessionMinutes <= 30 ? 2 : 1) : 0;
  return (p.level.includes(profile.level) ? 2 : 0) + (canDo(p, profile.equipment) ? 2 : 0) + (p.goals.includes(profile.goal) ? 1 : 0) + (p.daysPerWeek === profile.daysPerWeek ? 1 : 0) + timeScore;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
