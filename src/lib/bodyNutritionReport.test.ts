import { describe, expect, it } from 'vitest';
import { bodyNutritionReport as raw, type BodyNutritionData } from './bodyNutritionReport';
import { deficitTally } from './deficit';
import { DEFAULT_PROFILE } from './store';
import type { BodyEntry, FoodEntry, Workout } from './types';

// Espaces fines des milliers (fr-FR) remplacées par des espaces simples pour comparer.
const report = (...args: Parameters<typeof raw>) => raw(...args).replace(/[  ]/g, ' ');
const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).replace(/[  ]/g, ' ');
const signedFr = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fr(Math.abs(v))}`;
const rows = (r: string) => r.split('\n').filter((l) => /^\| (lun|mar|mer|jeu|ven|sam|dim)\./.test(l));

// Du lundi 5 au mercredi 14 octobre 2026 ; données fictives.
const FROM = '2026-10-05';
const TODAY = '2026-10-14';
const profile = { ...DEFAULT_PROFILE, name: 'Testeur', birthYear: 1990, heightCm: 175, activity: 'sedentary' as const, targetWeightKg: 80, targetBodyFatPct: 15 };
const body: BodyEntry[] = [
  { id: 'b1', date: '2026-10-05', weightKg: 90, bodyFatPct: 25, bia: { muscleKg: 63.2, waterPct: 52.1 } },
  { id: 'b2', date: '2026-10-08', weightKg: 89.4 },
  { id: 'b3', date: '2026-10-12', weightKg: 89, bodyFatPct: 24.5, bia: { muscleKg: 63, waterPct: 52.4 } },
  { id: 'b4', date: '2026-10-14', weightKg: 88.8 },
];
let i = 0;
const meal = (date: string, kcal: number, proteinG?: number): FoodEntry => ({ id: `f${i++}`, date, at: `${date}T12:00:00.000Z`, kcal, proteinG });
const food = [
  meal('2026-10-05', 2000, 150),
  meal('2026-10-06', 1200, 80),
  meal('2026-10-06', 900, 80),
  meal('2026-10-08', 800, 60), // moins de la moitié du métabolisme de base : repas oubliés
  meal('2026-10-09', 2600, 140), // surplus
  meal('2026-10-10', 1900),
  meal('2026-10-11', 2000, 150),
  meal('2026-10-12', 2050, 170),
  meal('2026-10-13', 1950, 160),
  meal('2026-10-14', 600, 50), // journée en cours
];
const workouts: Workout[] = [{ id: 'w1', date: '2026-10-06T16:00:00.000Z', dayName: 'Haut du corps', exercises: [], durationMin: 60, finished: true }];
const data: BodyNutritionData = { profile, body, food, workouts, cardio: [], kcalAdjust: 0 };

describe('tableau pesées et nutrition pour une IA', () => {
  it('profil en tête : sexe, âge, taille, poids, métabolisme de base, sans le prénom', () => {
    const r = report(data, FROM, TODAY);
    expect(r.split('\n')[0]).toBe('# Mes pesées et ma nutrition, du 5 octobre au 14 octobre 2026 (10 jours)');
    const head = r.slice(0, r.indexOf('## Ce que je te demande'));
    expect(head).toContain('- Sexe : homme');
    expect(head).toContain('- Âge : 36 ans');
    expect(head).toContain('- Taille : 175 cm');
    expect(head).toContain('- Poids : 88,8 kg à la dernière pesée (14 octobre 2026) ; poids lissé');
    expect(head).toMatch(/- Métabolisme de base : \d[\d ]* kcal\/jour \(formule /);
    expect(head).toContain('- Activité hors sport : sédentaire (bureau, peu de déplacements), soit un facteur de 1,2');
    expect(head).toMatch(/- Dépense estimée : \d[\d ]* kcal\/jour hors sport \(métabolisme de base × 1,2\) ; /);
    expect(head).toContain('- Objectif : 80 kg et 15 % de masse grasse');
    expect(r).toContain('**Suis-je bien en déficit tout le long ?**');
    expect(r).not.toContain('Testeur');
  });

  it('une ligne par jour : pesée, repas et déficit, avec les mêmes chiffres que le compteur', () => {
    const r = report(data, FROM, TODAY);
    expect(r.split('\n').find((l) => l.startsWith('| Date |'))).toBe(
      '| Date | Poids (kg) | Poids lissé (kg) | Gras (%) | Masse grasse (kg) | Muscle (kg) | Eau (%) | Mangé (kcal) | Protéines (g) | Sport (kcal) | Dépense (kcal) | Déficit (kcal) |',
    );
    const rs = rows(r);
    expect(rs).toHaveLength(10);
    expect(rs[0]).toMatch(/^\| lun\. 05\/10 \| 90 \| 90 \| 25 \| 22,5 \| 63,2 \| 52,1 \| 2 000 \| 150 \| 0 \| /);
    expect(rs[2]).toBe('| mer. 07/10 | — | — | — | — | — | — | non noté | — | — | — | — |');
    expect(rs[3]).toContain('| 800 (incomplet ?) | 60 | — | — | non compté |');
    expect(rs[9]).toContain('| mer. 14/10 (aujourd’hui) | 88,8 |');
    expect(rs[9]).toContain('| 600 (en cours) | 50 | — | — | journée en cours |');

    const tally = deficitTally(data, FROM, TODAY);
    expect(tally.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
    expect(tally.days[1].sport).toBeGreaterThan(0);
    for (const d of tally.days) {
      const row = rs.find((x) => x.includes(` ${d.date.slice(8)}/${d.date.slice(5, 7)} `))!;
      expect(row.endsWith(`| ${fr(d.sport)} | ${fr(d.burned)} | ${signedFr(d.deficit)} |`)).toBe(true);
    }
  });

  it('semaine par semaine et synthèse : jours comptés, déficit cumulé, surplus, poids et masse grasse', () => {
    const r = report(data, FROM, TODAY);
    const tally = deficitTally(data, FROM, TODAY);
    const weeks = r.split('\n').filter((l) => /^\| (du|le) /.test(l));
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatch(/^\| du 5 oct\. au 11 oct\. \| 5\/7 \| /);
    expect(weeks[1]).toMatch(/^\| du 12 oct\. au 14 oct\. \| 2\/2 \| /);
    expect(r).toContain(
      '- Jours comptés dans le déficit : 7 sur 9 jours passés. Non comptés : 1 jour sans repas noté, 1 jour incomplet (moins de la moitié du métabolisme de base noté). Aujourd’hui n’est pas compté',
    );
    expect(r).toContain(`- Déficit cumulé : ${signedFr(tally.total)} kcal`);
    expect(r).toMatch(/1 jour en surplus : ven\. 09\/10 \(−\d+\)\./);
    expect(r).toContain('- Poids lissé : 90 kg le 5 oct. → ');
    expect(r).toContain('- Perte attendue d’après le déficit compté (jours comptés seulement)');
    expect(r).toContain('- Masse grasse : 22,5 kg le 5 oct. → 21,8 kg le 12 oct., soit −0,7 kg');
  });

  it('colonnes de composition seulement si mesurées ; sans pesée, pas de déficit', () => {
    const plain = report({ ...data, body: body.map((e) => ({ id: e.id, date: e.date, weightKg: e.weightKg })) }, FROM, TODAY);
    expect(plain.split('\n').find((l) => l.startsWith('| Date |'))).toBe('| Date | Poids (kg) | Poids lissé (kg) | Mangé (kcal) | Protéines (g) | Sport (kcal) | Dépense (kcal) | Déficit (kcal) |');
    expect(plain).not.toContain('- Masse grasse :');

    const none = report({ ...data, body: [] }, FROM, TODAY);
    expect(none).toContain('- Poids : aucune pesée enregistrée');
    expect(none).not.toContain('- Métabolisme de base :');
    expect(none).toContain('- Aucune pesée : sans poids');
    expect(rows(none)[0]).toContain('| 2 000 | 150 | — | — | non compté |');
  });

  it('période à cheval sur deux années : année dans le titre et les dates', () => {
    const r = report({ ...data, body: [{ id: 'x', date: '2025-12-30', weightKg: 91 }], food: [meal('2025-12-31', 2500)] }, '2025-12-30', '2026-01-02');
    expect(r.split('\n')[0]).toBe('# Mes pesées et ma nutrition, du 30 décembre 2025 au 2 janvier 2026 (4 jours)');
    expect(rows(r)[0]).toMatch(/^\| mar\. 30\/12\/25 \| 91 \|/);
    expect(rows(r)).toHaveLength(4);
  });
});
