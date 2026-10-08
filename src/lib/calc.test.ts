import { describe, expect, it } from 'vitest';
import { adaptiveAdjustment, computeBmr, composition, currentComposition, e1rm, setE1rm, navyBodyFat, nutritionTargets, volumeFromSets, weeklyRate, weightTrend } from './calc';
import { generateProgram, splitFor, SPLITS } from './generator';
import { prefillSets, suggest } from './progression';
import { DEFAULT_PROFILE } from './store';
import type { BodyEntry, LoggedExercise, PlannedExercise, Profile } from './types';
import { getExercise } from '../data/exercises';
import { PROGRAMS } from '../data/programs';

const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', heightCm: 180, birthYear: 1990 };

describe('composition corporelle', () => {
  it('estime le % de gras par la méthode US Navy', () => {
    // Homme 180 cm, taille 85 cm, cou 38 cm → ≈ 16 %
    expect(navyBodyFat('male', 180, 85, 38)).toBeCloseTo(16.1, 1);
    // Femme 165 cm, taille 72, cou 32, hanches 98 → ≈ 27 %
    expect(navyBodyFat('female', 165, 72, 32, 98)).toBeCloseTo(27.4, 1);
    expect(navyBodyFat('female', 165, 72, 32)).toBeUndefined();
  });

  it('calcule masses grasse / maigre et FFMI', () => {
    const c = composition({ id: '1', date: '2026-01-01', weightKg: 80, bodyFatPct: 15 }, profile);
    expect(c.fatKg).toBe(12);
    expect(c.leanKg).toBe(68);
    expect(c.ffmi).toBeCloseTo(21, 0);
  });
});

describe('composition actuelle', () => {
  it('reprend le dernier % de gras mesuré quand la dernière pesée n’a pas de mensurations', () => {
    const body: BodyEntry[] = [
      { id: 'a', date: '2026-01-01', weightKg: 80, bodyFatPct: 20 },
      { id: 'b', date: '2026-01-05', weightKg: 79 },
    ];
    const c = currentComposition(body, profile)!;
    expect(c.bodyFatPct).toBe(20);
    expect(c.bfDate).toBe('2026-01-01');
    expect(c.leanKg).toBeGreaterThan(62);
  });

  it('ignore une mesure de plus de 60 jours', () => {
    const body: BodyEntry[] = [
      { id: 'a', date: '2026-01-01', weightKg: 80, bodyFatPct: 20 },
      { id: 'b', date: '2026-04-01', weightKg: 76 },
    ];
    expect(currentComposition(body, profile)!.bodyFatPct).toBeUndefined();
  });
});

describe('tendance de poids', () => {
  const entries: BodyEntry[] = Array.from({ length: 21 }, (_, i) => ({
    id: String(i),
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    weightKg: 80 - i * 0.1 + (i % 2 ? 0.4 : -0.4),
  }));

  it('mesure le rythme hebdomadaire malgré le bruit', () => {
    const rate = weeklyRate(entries, 30, new Date('2026-01-22'));
    expect(rate).toBeCloseTo(-0.7, 1);
  });

  it('lisse les variations quotidiennes', () => {
    const t = weightTrend(entries);
    const swings = t.slice(1).map((p, i) => Math.abs(p.trend - t[i].trend));
    expect(Math.max(...swings)).toBeLessThan(0.4);
  });
});

describe('nutrition', () => {
  it('crée un déficit en sèche et des protéines élevées', () => {
    const latest = { id: '1', date: '2026-01-01', weightKg: 80 };
    const cut = nutritionTargets({ ...profile, goal: 'cut' }, latest);
    expect(cut.calories).toBeLessThan(cut.tdee);
    expect(cut.proteinG).toBe(176);
    expect(cut.proteinG * 4 + cut.fatG * 9 + cut.carbsG * 4).toBeCloseTo(cut.calories, -1);
    const bulk = nutritionTargets({ ...profile, goal: 'bulk' }, latest);
    expect(bulk.calories).toBeGreaterThan(bulk.tdee);
  });

  it('formules de métabolisme de base au choix', () => {
    const age = new Date().getFullYear() - 1990;
    // Mifflin-St Jeor, homme 80 kg / 180 cm
    expect(computeBmr(profile, 80).bmr).toBeCloseTo(10 * 80 + 6.25 * 180 - 5 * age + 5, 5);
    expect(computeBmr(profile, 80).method).toBe('mifflin');
    // Auto + % de gras connu → Katch-McArdle (masse maigre 64 kg)
    expect(computeBmr(profile, 80, 20)).toEqual({ bmr: 370 + 21.6 * 64, method: 'katch', autoReason: 'lean' });
    expect(computeBmr({ ...profile, bmrMethod: 'cunningham' }, 80, 20).bmr).toBeCloseTo(500 + 22 * 64, 5);
    expect(computeBmr({ ...profile, bmrMethod: 'tinsley' }, 80, 20).bmr).toBeCloseTo(284 + 25.9 * 64, 5);
    expect(computeBmr({ ...profile, bmrMethod: 'harris' }, 80).bmr).toBeCloseTo(88.362 + 13.397 * 80 + 4.799 * 180 - 5.677 * age, 5);
    // Formule « masse maigre » sans % de gras : repli sur Mifflin-St Jeor
    expect(computeBmr({ ...profile, bmrMethod: 'tinsley' }, 80).method).toBe('mifflin');
    const t = nutritionTargets({ ...profile, bmrMethod: 'harris' }, { id: '1', date: '2026-01-01', weightKg: 80 });
    expect(t.methodId).toBe('harris');
  });

  it('propose un ajustement quand la tendance dévie', () => {
    expect(adaptiveAdjustment(-0.1, -0.6)).toBe(-250);
    expect(adaptiveAdjustment(-0.3, -0.6)).toBe(-150);
    expect(adaptiveAdjustment(-0.45, -0.6)).toBe(0);
    expect(adaptiveAdjustment(-1.2, -0.6)).toBe(250);
    expect(adaptiveAdjustment(undefined, -0.6)).toBe(0);
  });
});

describe('performance', () => {
  it('estime le 1RM (Epley)', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.7, 1);
  });

  it('inclut le poids du corps pour les tractions', () => {
    expect(setE1rm('pullup', 0, 10, 80)).toBeCloseTo(106.7, 1);
    expect(setE1rm('bench', 80, 1, 80)).toBe(80);
  });

  it('compte 1 série par muscle principal et ½ par secondaire', () => {
    const v = volumeFromSets([{ exerciseId: 'bench', sets: 4 }]);
    expect(v.chest).toBe(4);
    expect(v.triceps).toBe(2);
  });
});

describe('surcharge progressive', () => {
  const sets = (w: number, reps: number[]): LoggedExercise => ({ exerciseId: 'bench', sets: reps.map((r) => ({ weight: w, reps: r, done: true })) });
  const dbl: PlannedExercise = { exerciseId: 'bench', sets: 3, repMin: 8, repMax: 12, rir: 1, restSec: 120 };
  const lin: PlannedExercise = { exerciseId: 'bench', sets: 5, repMin: 5, repMax: 5, rir: 1, restSec: 180 };

  it('double progression : ajoute des reps puis de la charge', () => {
    expect(suggest(dbl, [{ ex: sets(60, [10, 9, 9]) }])).toMatchObject({ weight: 60, reps: 10 });
    expect(suggest(dbl, [{ ex: sets(60, [12, 12, 12]) }])).toMatchObject({ weight: 62.5, reps: 8 });
    expect(suggest(dbl, [{ ex: sets(60, [12, 12, 11]) }])).toMatchObject({ weight: 62.5 });
    expect(suggest(dbl, [{ ex: sets(60, [11, 12, 12]) }])).toMatchObject({ weight: 60 });
  });

  it('progression linéaire et décharge après 3 échecs', () => {
    expect(suggest(lin, [{ ex: sets(80, [5, 5, 5, 5, 5]) }])).toMatchObject({ weight: 82.5 });
    const fail = { ex: sets(80, [5, 5, 4, 4, 3]) };
    expect(suggest(lin, [fail])).toMatchObject({ weight: 80 });
    expect(suggest(lin, [fail, fail, fail])).toMatchObject({ weight: 72.5 });
  });

  describe('séries pré-remplies', () => {
    const pyramid: LoggedExercise = {
      exerciseId: 'leg_ext',
      sets: [
        { weight: 45, reps: 12, done: true },
        { weight: 73, reps: 12, done: true },
        { weight: 79, reps: 12, done: true },
        { weight: 85, reps: 14, done: true },
        { weight: 90, reps: 3, done: false },
      ],
    };
    const pairs = (xs: { weight: number; reps: number }[]) => xs.map((s) => `${s.weight}×${s.reps}`);

    it('exercice ajouté en séance : chaque série de la dernière fois, une par une', () => {
      const out = prefillSets([{ ex: pyramid }]);
      expect(pairs(out)).toEqual(['45×12', '73×12', '79×12', '85×14']);
      expect(out.every((s) => !s.done && s.rir === undefined)).toBe(true);
    });

    it('sans historique : 3 séries vides', () => {
      expect(pairs(prefillSets([]))).toEqual(['0×10', '0×10', '0×10']);
      expect(pairs(prefillSets([], dbl))).toEqual(['0×12', '0×12', '0×12']);
    });

    it('programme : montée en charge conservée, séries à la charge max selon la progression', () => {
      const target: PlannedExercise = { exerciseId: 'leg_ext', sets: 3, repMin: 10, repMax: 15, rir: 1, restSec: 90 };
      expect(pairs(prefillSets([{ ex: pyramid }], target))).toEqual(['45×12', '73×12', '79×12', '85×15']);
    });

    it('programme en séries égales : toutes les séries suivent la suggestion, complétées au nombre prévu', () => {
      expect(pairs(prefillSets([{ ex: sets(60, [12, 12, 12]) }], dbl))).toEqual(['62.5×8', '62.5×8', '62.5×8']);
      expect(pairs(prefillSets([{ ex: sets(60, [10, 9]) }], dbl))).toEqual(['60×10', '60×10', '60×10']);
    });
  });
});

describe('générateur de programme', () => {
  it.each([2, 3, 4, 5, 6])('génère %i séances respectant le matériel et la durée', (days) => {
    for (const equipment of ['full_gym', 'home_dumbbells', 'bodyweight'] as const) {
      const p = generateProgram({ ...profile, daysPerWeek: days, equipment, sessionMinutes: 60 });
      expect(p.days).toHaveLength(days);
      for (const d of p.days) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(3);
        expect(d.exercises.reduce((s, e) => s + e.sets, 0)).toBeLessThanOrEqual(Math.floor(60 / 3.5));
        for (const e of d.exercises) expect(getExercise(e.exerciseId).equipment).toContain(equipment);
        expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(d.exercises.length);
      }
    }
  });

  it.each([15, 30])('séances de %i min : peu de séries, repos courts', (minutes) => {
    for (const days of [2, 3, 4]) {
      const p = generateProgram({ ...profile, daysPerWeek: days, sessionMinutes: minutes });
      for (const d of p.days) {
        expect(d.exercises.reduce((s, e) => s + e.sets, 0)).toBeLessThanOrEqual(Math.floor(minutes / 2.5));
        for (const e of d.exercises) expect(e.restSec).toBeLessThanOrEqual(90);
      }
    }
  });

  it('chaque séance du haut contient élévations latérales et travail des bras', () => {
    for (const minutes of [45, 60, 75, 90]) {
      const p = generateProgram({ ...profile, daysPerWeek: 4, level: 'intermediate', sessionMinutes: minutes });
      const vol = volumeFromSets(p.days.flatMap((d) => d.exercises));
      for (const d of p.days.filter((d) => d.name.startsWith('Haut'))) expect(d.exercises.map((e) => e.exerciseId)).toContain('lateral_raise');
      for (const m of ['quads', 'chest', 'back', 'hamstrings', 'triceps', 'shoulders'] as const) expect(vol[m]).toBeLessThanOrEqual(22);
      if (minutes >= 60) expect(vol.biceps).toBeGreaterThanOrEqual(8);
    }
  });

  it('donne plus de volume aux muscles prioritaires', () => {
    const base = generateProgram({ ...profile, daysPerWeek: 4, sessionMinutes: 90 });
    const prio = generateProgram({ ...profile, daysPerWeek: 4, sessionMinutes: 90, priorities: ['shoulders'] });
    const vol = (p: typeof base) => volumeFromSets(p.days.flatMap((d) => d.exercises)).shoulders;
    expect(vol(prio)).toBeGreaterThan(vol(base));
  });

  it('chaque type de programme donne le bon nombre de séances, avec le matériel et la durée respectés', () => {
    for (const split of Object.keys(SPLITS) as (keyof typeof SPLITS)[])
      for (const days of [2, 3, 4, 5, 6])
        for (const equipment of ['full_gym', 'home_dumbbells', 'bodyweight'] as const) {
          const p = generateProgram({ ...profile, daysPerWeek: days, equipment, sessionMinutes: 60, split });
          expect(p.days, `${split} ${days} ${equipment}`).toHaveLength(days);
          for (const d of p.days) {
            expect(d.exercises.length, `${split} ${days} ${equipment} ${d.name}`).toBeGreaterThanOrEqual(2);
            expect(d.exercises.reduce((s, e) => s + e.sets, 0)).toBeLessThanOrEqual(Math.floor(60 / 3.5) + 2);
            for (const e of d.exercises) expect(getExercise(e.exerciseId).equipment).toContain(equipment);
            expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(d.exercises.length);
          }
        }
  });

  it('3 séances : full body, haut/bas, PPL, mix ou split par muscle selon le choix', () => {
    const names = (split: Parameters<typeof splitFor>[1]) => generateProgram({ ...profile, daysPerWeek: 3, split }).days.map((d) => d.name);
    expect(names('auto')).toEqual(['Full body A', 'Full body B', 'Full body C']);
    expect(names('upper_lower')).toEqual(['Haut du corps A', 'Bas du corps', 'Haut du corps B']);
    expect(names('ppl')).toEqual(['Push (pecs/épaules/triceps)', 'Pull (dos/biceps)', 'Jambes']);
    expect(names('mix')).toEqual(['Haut du corps', 'Bas du corps', 'Full body']);
    expect(names('bro')).toEqual(['Pecs / dos', 'Jambes', 'Épaules / bras']);
    expect(splitFor(3, 'bro').note).toMatch(/une fois par semaine/);
    expect(splitFor(2, 'ppl')).toMatchObject({ label: 'Full body ×2', note: expect.stringMatching(/au moins 3/) });
  });

  it('machines de préférence : surtout des machines guidées, seulement en salle', () => {
    const machineShare = (p: ReturnType<typeof generateProgram>) => {
      const ex = p.days.flatMap((d) => d.exercises);
      return ex.filter((e) => getExercise(e.exerciseId).machine).length / ex.length;
    };
    const base = generateProgram({ ...profile, daysPerWeek: 3, equipment: 'full_gym' });
    const m = generateProgram({ ...profile, daysPerWeek: 3, equipment: 'full_gym', preferMachines: true });
    expect(machineShare(m)).toBeGreaterThan(0.6);
    expect(machineShare(m)).toBeGreaterThan(machineShare(base));
    expect(m.days[0].exercises.map((e) => e.exerciseId)).toContain('m_chest_press');
    const home = generateProgram({ ...profile, daysPerWeek: 3, equipment: 'home_dumbbells', preferMachines: true });
    expect(machineShare(home)).toBe(0);
  });

  it('les programmes de la bibliothèque n’utilisent que des exercices connus', () => {
    for (const p of PROGRAMS) for (const d of p.days) for (const e of d.exercises) expect(getExercise(e.exerciseId).primary.length).toBeGreaterThan(0);
  });
});

describe('garde-fous (test de singe)', () => {
  it('la cible calorique ne descend jamais sous le plancher de sécurité', async () => {
    const latest = { id: '1', date: '2026-01-01', weightKg: 50 };
    const t = nutritionTargets({ ...profile, sex: 'female', goal: 'cut', activity: 'sedentary' }, latest, undefined, -2000);
    expect(t.calories).toBeGreaterThanOrEqual(Math.max(1200, t.bmr));
    expect(t.floored).toBe(true);
  });

  it('un profil absurde (taille, année) est ramené à des valeurs plausibles', async () => {
    const { sanitizeProfile, DEFAULT_PROFILE: D } = await import('./store');
    const p = sanitizeProfile({ ...profile, heightCm: -5, birthYear: 99999, daysPerWeek: 0, sessionMinutes: 1e9 });
    expect(p.heightCm).toBe(D.heightCm);
    expect(p.birthYear).toBe(D.birthYear);
    expect(p.daysPerWeek).toBe(D.daysPerWeek);
    expect(p.sessionMinutes).toBe(D.sessionMinutes);
    expect(sanitizeProfile({ ...profile, heightCm: 182, birthYear: 1990 }).heightCm).toBe(182);
  });
});

describe('tendance après une longue interruption', () => {
  it('repart de la pesée du jour au lieu de la mélanger avec des pesées anciennes', () => {
    const old = [128, 124, 118.5, 113.5, 110, 107, 104, 101, 98, 96].map((w, i) => ({ id: `o${i}`, date: `2019-${String(i + 2).padStart(2, '0')}-10`, weightKg: w }));
    const t = weightTrend([...old, { id: 'n', date: '2026-10-02', weightKg: 117.7 }]);
    expect(t.at(-1)!.trend).toBe(117.7);
    expect(currentComposition([...old, { id: 'n', date: '2026-10-02', weightKg: 117.7 }], profile)!.weightKg).toBe(117.7);
  });

  it('un écart de quelques jours reste lissé normalement', () => {
    const t = weightTrend([
      { id: 'a', date: '2026-10-01', weightKg: 100 },
      { id: 'b', date: '2026-10-03', weightKg: 102 },
    ]);
    expect(t.at(-1)!.trend).toBe(100.5);
  });
});

describe('formule automatique et % de gras élevé', () => {
  it('repasse sur Mifflin-St Jeor au-delà de 25 % (hommes) / 32 % (femmes)', () => {
    expect(computeBmr(profile, 117.7, 33.2)).toMatchObject({ method: 'mifflin', autoReason: 'highFat' });
    expect(computeBmr(profile, 80, 24.9)).toMatchObject({ method: 'katch', autoReason: 'lean' });
    expect(computeBmr({ ...profile, sex: 'female' }, 70, 30).method).toBe('katch');
    expect(computeBmr({ ...profile, sex: 'female' }, 70, 32).method).toBe('mifflin');
    expect(computeBmr(profile, 80)).toMatchObject({ method: 'mifflin', autoReason: 'noFat' });
  });

  it('un choix manuel est respecté même avec un % de gras élevé', () => {
    expect(computeBmr({ ...profile, bmrMethod: 'katch' }, 117.7, 33.2).method).toBe('katch');
  });
});

describe('rythme réaliste quand la cible est bornée', () => {
  it('déficit plafonné à 25 % : rythme attendu moins rapide que visé', () => {
    const t = nutritionTargets({ ...profile, heightCm: 178, goal: 'cut', activity: 'sedentary' }, { id: '1', date: '2026-10-02', weightKg: 117.7 }, 33.2);
    expect(t.capped).toBe(true);
    expect(t.expectedRateKg).toBeLessThan(0);
    expect(t.expectedRateKg!).toBeGreaterThan(t.targetRateKg);
    expect(t.expectedRateKg!).toBeCloseTo(((t.calories - t.tdee) * 7) / 7700, 1);
  });

  it('plancher de sécurité : rythme calculé sur les calories réellement données', () => {
    const t = nutritionTargets({ ...profile, sex: 'female', goal: 'cut', activity: 'sedentary', heightCm: 155 }, { id: '1', date: '2026-01-01', weightKg: 50 }, undefined, -400);
    expect(t.floored).toBe(true);
    expect(t.expectedRateKg).toBeCloseTo(((t.calories - t.tdee + 400) * 7) / 7700, 1);
  });

  it('cible atteignable : pas de rythme corrigé', () => {
    const t = nutritionTargets({ ...profile, goal: 'bulk' }, { id: '1', date: '2026-01-01', weightKg: 80 });
    expect(t.expectedRateKg).toBeUndefined();
  });
});

describe('protéines en surpoids', () => {
  const big: Profile = { ...profile, heightCm: 178, goal: 'cut' };
  const latest = { id: '1', date: '2026-10-02', weightKg: 117.7 };

  it('calcule les g/kg sur la masse maigre ramenée à 15 % de gras', () => {
    const t = nutritionTargets(big, latest, 33.2);
    expect(t.refWeightKg).toBeCloseTo(92.5, 1);
    expect(t.proteinG).toBe(204);
  });

  it('sans % de gras : poids ajusté (IMC 25 + 40 % de l’excédent)', () => {
    const t = nutritionTargets(big, latest);
    expect(t.refWeightKg).toBeCloseTo(94.5, 0);
    expect(t.proteinG).toBeGreaterThan(200);
    expect(t.proteinG).toBeLessThan(215);
  });

  it('ne change rien pour un poids normal ou un sujet sec', () => {
    expect(nutritionTargets(profile, { id: '1', date: '2026-01-01', weightKg: 75 }, 12).refWeightKg).toBe(75);
  });
});
