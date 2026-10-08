import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from './store';
import type { BodyEntry, CardioEntry, FoodEntry, Profile, Workout } from './types';
import { defaultReportWeek, setText, weekStartOf, weeklyReport as rawReport, type ReportData } from './weeklyReport';

// Espaces fines insécables des nombres français (« 2 100 ») ramenées à des espaces simples pour les assertions.
const weeklyReport = (...args: Parameters<typeof rawReport>) => rawReport(...args).replace(/[\u202f\u00a0]/g, ' ');

const profile: Profile = { ...DEFAULT_PROFILE, name: 'Vincent', sex: 'male', birthYear: 1993, heightCm: 178, goal: 'cut', daysPerWeek: 3, priorities: ['shoulders'], targetWeightKg: 95 };

const workout = (day: string, sets: [number, number, number?][], extra: Partial<Workout> = {}): Workout => ({
  id: day,
  date: `${day}T18:00:00.000Z`,
  dayName: 'Haut du corps A',
  finished: true,
  durationMin: 60,
  exercises: [
    {
      exerciseId: 'bench',
      target: { exerciseId: 'bench', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150 },
      sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir, done: true })),
    },
    { exerciseId: 'pullup', sets: [{ weight: 10, reps: 6, done: true }, { weight: 10, reps: 5, done: false }] },
  ],
  ...extra,
});

const body: BodyEntry[] = [
  { id: 'b1', date: '2026-09-21', weightKg: 118.4 },
  { id: 'b2', date: '2026-09-25', weightKg: 118.0, bodyFatPct: 33.6, bia: { muscleKg: 74 } },
  { id: 'b3', date: '2026-09-28', weightKg: 117.9 },
  { id: 'b4', date: '2026-10-01', weightKg: 117.2, waistCm: 112, bodyFatPct: 33.2, bia: { muscleKg: 74.2, visceral: 14 } },
];
const food: FoodEntry[] = [
  { id: 'f1', date: '2026-09-28', at: '2026-09-28T12:00:00Z', kcal: 1200, proteinG: 90 },
  { id: 'f2', date: '2026-09-28', at: '2026-09-28T19:00:00Z', kcal: 900, proteinG: 80 },
  { id: 'f3', date: '2026-09-30', at: '2026-09-30T12:00:00Z', kcal: 2050 },
  { id: 'f4', date: '2026-09-22', at: '2026-09-22T12:00:00Z', kcal: 2400 },
];
const cardio: CardioEntry[] = [
  { id: 'c1', date: '2026-09-29', inclinePct: 2, speedKmh: 2.3, durationMin: 75 },
  { id: 'c2', date: '2026-09-23', inclinePct: 0, steps: 6000 },
];
const data: ReportData = {
  profile,
  body,
  food,
  cardio,
  kcalAdjust: -100,
  workouts: [
    workout('2026-09-22', [[77.5, 8], [77.5, 8], [77.5, 7]]),
    workout('2026-09-28', [[80, 8, 2], [80, 8, 1], [80, 7, 1]], { note: 'Bien dormi' }),
    workout('2026-10-01', [[82.5, 6, 1]], { dayName: 'Haut du corps B', durationMin: undefined }),
  ],
};

describe('bilan de la semaine', () => {
  it('semaines du lundi au dimanche ; par défaut la semaine écoulée en début de semaine', () => {
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28'); // dimanche
    expect(weekStartOf('2026-09-28')).toBe('2026-09-28'); // lundi
    expect(defaultReportWeek('2026-10-05')).toBe('2026-09-28'); // lundi : semaine précédente
    expect(defaultReportWeek('2026-10-06')).toBe('2026-09-28'); // mardi : semaine précédente
    expect(defaultReportWeek('2026-10-08')).toBe('2026-10-05'); // jeudi : semaine en cours
  });

  it('notation des séries : charge × répétitions, RIR, lest pour les tractions', () => {
    expect(setText('bench', { weight: 80, reps: 8, rir: 2, done: true })).toBe('80×8 @2');
    expect(setText('bench', { weight: 82.5, reps: 6, done: true })).toBe('82,5×6');
    expect(setText('pullup', { weight: 10, reps: 6, done: true })).toBe('PDC+10×6');
    expect(setText('pullup', { weight: 0, reps: 8, done: true })).toBe('PDC×8');
    expect(setText('pushup', { weight: 0, reps: 15, done: true })).toBe('15');
  });

  it('contient la demande d’analyse, le profil sans le prénom, et chaque section', () => {
    const r = weeklyReport(data, '2026-09-28', '2026-10-08');
    expect(r).toMatch(/^# Bilan de la semaine du lundi 28 septembre au dimanche 4 octobre 2026/);
    expect(r).toContain('## Ta mission');
    expect(r).toContain('Plan pour la semaine prochaine');
    expect(r).not.toContain('Vincent');
    expect(r).toContain('Homme, 33 ans, 178 cm');
    expect(r).toContain('muscles prioritaires : épaules');
    expect(r).toContain('Objectif chiffré : 95 kg');
    for (const h of ['## Profil', '## Corps', '## Nutrition', '## Entraînement', '## Marche et activité', '## Comparaison avec la semaine précédente']) expect(r).toContain(h);
    expect(r).not.toContain('Semaine en cours');
  });

  it('corps : pesées, tendance, composition, mensurations et balance', () => {
    const r = weeklyReport(data, '2026-09-28', '2026-10-08');
    expect(r).toContain('Pesées : lun. 28 sept. 117,9 kg · jeu. 1 oct. 117,2 kg');
    expect(r).toMatch(/Poids lissé \(tendance\) : [\d,]+ kg fin de semaine précédente → [\d,]+ kg \(−[\d,]+ kg\)/);
    expect(r).toContain('Masse grasse : 33,2 % (balance à impédancemètre, mesure du jeu. 1 oct.)');
    expect(r).toContain('Mesure précédente : 33,6 % le ven. 25 sept.\n');
    expect(r).not.toContain('..');
    expect(r).toContain('Mensurations du jeu. 1 oct. : taille 112 cm');
    expect(r).toContain('Balance du jeu. 1 oct. : muscle 74,2 kg, graisse viscérale 14');
  });

  it('nutrition : cible de l’app, tableau par jour et moyennes des jours notés', () => {
    const r = weeklyReport(data, '2026-09-28', '2026-10-08');
    expect(r).toMatch(/Cible de l'app : [\d ]+ kcal\/jour et \d+ g de protéines\. Maintenance estimée [\d ]+ kcal = métabolisme de base [\d ]+ kcal \(Mifflin-St Jeor\)/);
    expect(r).toContain('ajustement adaptatif −100 kcal inclus');
    expect(r).toContain('| lun. 28 sept. | 2 100 kcal | 170 g |');
    expect(r).toContain('| mar. 29 sept. | non noté | — |');
    expect(r).toContain('| mer. 30 sept. | 2 050 kcal | — |');
    expect(r).toMatch(/Jours notés : 2\/7 · moyenne des jours notés : 2 075 kcal/);
  });

  it('entraînement : séries validées seulement, objectif du programme, notes, progression et volume', () => {
    const r = weeklyReport(data, '2026-09-28', '2026-10-08');
    expect(r).toContain('2 séances sur 3 prévues');
    expect(r).toContain('### lun. 28 sept. – Haut du corps A (60 min)');
    expect(r).toContain('- Développé couché : 80×8 @2, 80×8 @1, 80×7 @1 — prévu 3×6–10 @2');
    expect(r).toContain('- Tractions : PDC+10×6'); // la série non validée n'apparaît pas
    expect(r).not.toContain('PDC+10×5');
    expect(r).toContain('Note : « Bien dormi »');
    // Meilleure série de la semaine (80×8 ≈ 101,3 kg, devant 82,5×6 ≈ 99 kg) contre la dernière séance avant (77,5×8 ≈ 98,2 kg).
    expect(r).toContain('- Développé couché : 101,3 kg (80×8 @2) ; avant : 98,2 kg le mar. 22 sept. (+3,1 kg)');
    expect(r).toContain('tractions et dips : poids du corps compris');
    expect(r).toContain('| Pectoraux | 4 | 10 | 8 / 12–20 |'); // profil débutant : 10 séries visées
    expect(r).toContain('| Épaules |'); // tous les muscles listés
  });

  it('marche, régularité et comparaison avec la semaine précédente', () => {
    const r = weeklyReport(data, '2026-09-28', '2026-10-08');
    expect(r).toMatch(/1 marche : 1 h 15, [\d,]+ km/);
    expect(r).toContain('- mar. 29 sept. : 75 min à 2,3 km/h, pente 2 %');
    expect(r).toMatch(/Régularité : \d\/7 jours actifs/);
    expect(r).toContain('série au dim. 4 oct.');
    expect(r).toContain('- Séances : 1 → 2 · séries : 4 → 6');
    expect(r).toContain('- Marche : 1 → 1 sorties');
    expect(r).toContain('- Calories moyennes (jours notés) : 2 400 → 2 075 kcal.');
  });

  it('semaine en cours : arrêtée à aujourd’hui et signalée', () => {
    const r = weeklyReport(data, '2026-09-28', '2026-09-30');
    expect(r).toContain('*Semaine en cours : données jusqu\'au mercredi 30 septembre inclus.*');
    expect(r).toContain('1 séance sur 3 prévues');
    expect(r).toContain('Jours notés : 2/3');
    expect(r).toContain('la semaine en cours ne compte que 3 jours');
    expect(r).not.toContain('jeu. 1 oct.');
  });

  it('sans aucune donnée : un bilan lisible, sans plantage', () => {
    const r = weeklyReport({ profile, body: [], workouts: [], cardio: [], food: [], kcalAdjust: 0 }, '2026-09-28', '2026-10-08');
    expect(r).toContain('Aucune pesée enregistrée.');
    expect(r).toContain('Aucun repas noté cette semaine.');
    expect(r).toContain('0 séance sur 3 prévues');
    expect(r).toContain('Aucune marche enregistrée.');
    expect(r).toContain('calories non notées');
    expect(r).not.toContain('NaN');
    expect(r).not.toContain('undefined');
  });
});
