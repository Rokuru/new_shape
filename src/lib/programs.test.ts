import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise } from '../data/exercises';
import { PROGRAMS } from '../data/programs';
import { canDo, programScore, programStats } from './programStats';
import { DEFAULT_PROFILE } from './store';

const byId = (id: string) => PROGRAMS.find((p) => p.id === id)!;

describe('bibliothèque de programmes', () => {
  it('contient au moins 26 programmes aux identifiants uniques', () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(26);
    expect(new Set(PROGRAMS.map((p) => p.id)).size).toBe(PROGRAMS.length);
  });

  it('chaque programme a un auteur, une description, une analyse et au moins une source https', () => {
    for (const p of PROGRAMS) {
      expect(p.author.length, p.id).toBeGreaterThan(10);
      expect(p.evidence?.length ?? 0, p.id).toBeGreaterThan(40);
      expect(p.style, p.id).toBeDefined();
      expect(p.sources?.length ?? 0, p.id).toBeGreaterThan(0);
      for (const s of p.sources!) expect(s.url, p.id).toMatch(/^https:\/\/[^\s]+$/);
    }
  });

  it('tous les exercices existent et les prescriptions sont cohérentes', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const p of PROGRAMS)
      for (const d of p.days) {
        expect(d.exercises.length, `${p.id} ${d.name}`).toBeGreaterThan(0);
        for (const e of d.exercises) {
          expect(ids.has(e.exerciseId), `${p.id} : ${e.exerciseId}`).toBe(true);
          expect(e.sets).toBeGreaterThan(0);
          expect(e.repMin).toBeGreaterThan(0);
          expect(e.repMax).toBeGreaterThanOrEqual(e.repMin);
          expect(e.rir).toBeGreaterThanOrEqual(0);
          expect(e.restSec).toBeGreaterThanOrEqual(10);
        }
      }
  });

  it('identifiants d’exercices uniques', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(getExercise('power_clean').primary).toContain('glutes');
  });

  it('couvre tous les styles, niveaux et un programme sans matériel', () => {
    const styles = new Set(PROGRAMS.map((p) => p.style));
    for (const s of ['force', 'powerbuilding', 'hypertrophie', 'haute_intensite', 'poids_du_corps', 'court']) expect(styles.has(s as never)).toBe(true);
    for (const l of ['beginner', 'intermediate', 'advanced'] as const) expect(PROGRAMS.some((p) => p.level.includes(l))).toBe(true);
    expect(PROGRAMS.filter((p) => canDo(p, 'bodyweight')).map((p) => p.id)).toContain('bwf_recommended_routine');
  });
});

describe('comparaison chiffrée', () => {
  it('le HIT de Yates a un volume bien plus faible que PHAT', () => {
    const yates = programStats(byId('yates_blood_guts'));
    const phat = programStats(byId('phat'));
    expect(yates.hardSets).toBeLessThan(40);
    expect(phat.hardSets).toBeGreaterThan(yates.hardSets * 2);
    expect(yates.belowMev.length).toBeGreaterThan(phat.belowMev.length);
    expect(yates.frequency).toBeLessThan(programStats(byId('phat')).frequency);
  });

  it('les programmes de force ont une part de séries lourdes supérieure aux programmes d’hypertrophie', () => {
    expect(programStats(byId('texas_method')).heavyShare).toBeGreaterThan(0.7);
    expect(programStats(byId('lyle_gbr')).heavyShare).toBeLessThan(0.1);
  });

  it('ramène les rotations à la semaine (A/B sur 3 jours, Golden Six)', () => {
    const g6 = programStats(byId('golden_six'));
    expect(g6.hardSets).toBe(20 * 3);
    expect(g6.frequency).toBeGreaterThanOrEqual(2);
  });

  it('les séries de vitesse et de récupération ne comptent pas comme séries dures', () => {
    const tm = programStats(byId('texas_method'));
    // Lundi 11 + mercredi 9 (squat léger exclu) + vendredi 7.
    expect(tm.hardSets).toBe(11 + 9 + 7);
  });

  it('durée de séance plausible', () => {
    for (const p of PROGRAMS) {
      const { minutes } = programStats(p);
      expect(minutes, p.id).toBeGreaterThanOrEqual(p.style === 'court' ? 10 : 25);
      expect(minutes, p.id).toBeLessThanOrEqual(150);
    }
  });

  it('classe en tête les programmes faisables avec le matériel du profil', () => {
    const home = { ...DEFAULT_PROFILE, equipment: 'bodyweight' as const, level: 'beginner' as const, goal: 'recomp' as const, daysPerWeek: 3 };
    const best = [...PROGRAMS].sort((a, b) => programScore(b, home) - programScore(a, home))[0];
    expect(best.id).toBe('bwf_recommended_routine');
  });
});

describe('séances courtes (15–30 min)', () => {
  it('au moins 5 programmes de 30 min maximum, chacun sourcé', () => {
    const short = PROGRAMS.filter((p) => programStats(p).minutes <= 30);
    expect(short.length).toBeGreaterThanOrEqual(5);
    for (const p of short) expect(p.sources?.length ?? 0).toBeGreaterThan(0);
  });

  it('un profil « 15 min » voit d’abord des programmes courts', () => {
    const profile = { ...DEFAULT_PROFILE, sessionMinutes: 15, equipment: 'bodyweight' as const, level: 'beginner' as const, goal: 'cut' as const, daysPerWeek: 3 };
    const best = [...PROGRAMS].sort((a, b) => programScore(b, profile) - programScore(a, profile))[0];
    expect(programStats(best).minutes).toBeLessThanOrEqual(25);
  });
});

describe('fiches d’exercice', () => {
  it('chaque exercice a une fiche (schéma, matériel, consignes)', async () => {
    const { GUIDES, PATTERN_STEPS } = await import('../data/exerciseGuide');
    for (const e of EXERCISES) {
      expect(GUIDES[e.id], e.id).toBeDefined();
      expect(GUIDES[e.id].gear.length, e.id).toBeGreaterThan(2);
      expect(PATTERN_STEPS[GUIDES[e.id].pattern].length, e.id).toBeGreaterThanOrEqual(3);
    }
  });
});
