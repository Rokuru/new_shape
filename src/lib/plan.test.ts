import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASICFIT_CUT, PLAN_TEMPLATES } from '../data/plans';
import { EXERCISES } from '../data/exercises';
import { adjustSets, checkpoints, expectedWeight, goalMath, holidayWeeks, nextMonday, phaseDates, planAdjust, planEnd, planProgramFor, planProgramId, planStatus, planWeek, sessionDaysFrom, shortSessionName, trackingRows, weekSessions, weekSpan, weekTypeFrom } from './plan';
import { DEFAULT_PROFILE, sanitizeProfile, useStore } from './store';
import type { Profile, Workout } from './types';

const tpl = BASICFIT_CUT;
const START = '2026-10-12';
const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', heightCm: 178, birthYear: 1993, plan: { id: tpl.id, start: START } };
const pid = (i: number) => planProgramId(tpl, tpl.phases[i]);

describe('modèle du plan Basic-Fit', () => {
  it('phases contiguës de S1 à S34, exercices connus et prescriptions cohérentes', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    let next = 1;
    for (const p of tpl.phases) {
      expect(p.weeks[0]).toBe(next);
      next = p.weeks[1] + 1;
      expect(p.days.length).toBeGreaterThanOrEqual(2);
      for (const d of p.days)
        for (const e of d.exercises) {
          expect(ids.has(e.exerciseId), `${p.id} ${d.name} : ${e.exerciseId}`).toBe(true);
          expect(e.sets).toBeGreaterThan(0);
          expect(e.repMax).toBeGreaterThanOrEqual(e.repMin);
          expect(e.restSec).toBeGreaterThanOrEqual(0);
          if (e.note) expect(e.note.length).toBeLessThanOrEqual(300); // limite des programmes copiés
        }
    }
    expect(next - 1).toBe(tpl.weeks);
    expect(tpl.weeks).toBe(34);
    expect(tpl.tracked.every((t) => ids.has(t.id))).toBe(true);
    expect(new Set(PLAN_TEMPLATES.map((t) => t.id)).size).toBe(PLAN_TEMPLATES.length);
  });

  it('aucune donnée personnelle dans le modèle (dépôt public)', () => {
    const text = JSON.stringify(tpl);
    for (const s of ['Vincent', '118 kg', '33 %', '93 kg', '2 160', '12 oct']) expect(text).not.toContain(s);
  });
});

describe('calendrier du plan', () => {
  it('départ le lundi 12 octobre 2026 : mêmes dates que le plan', () => {
    expect(nextMonday('2026-10-10')).toBe(START); // samedi → lundi suivant
    expect(nextMonday(START)).toBe(START);
    expect(tpl.phases.map((p) => phaseDates(START, p))).toEqual([
      { from: '2026-10-12', to: '2026-11-22' },
      { from: '2026-11-23', to: '2027-01-17' },
      { from: '2027-01-18', to: '2027-03-28' },
      { from: '2027-03-29', to: '2027-06-06' },
    ]);
    expect(planEnd(tpl, START)).toBe('2027-06-06');
  });

  it('numéro de semaine, phase en cours et bornes', () => {
    expect(planWeek(START, '2026-10-10')).toBe(0);
    expect(planWeek(START, START)).toBe(1);
    expect(planWeek(START, '2026-10-18')).toBe(1);
    expect(planWeek(START, '2026-10-19')).toBe(2);
    expect(planStatus(profile, '2026-10-10')).toMatchObject({ week: 0, started: false, phaseIndex: 0 });
    expect(planStatus(profile, '2026-11-23')).toMatchObject({ week: 7, started: true, phaseIndex: 1 });
    expect(planStatus(profile, '2027-06-20')).toMatchObject({ finished: true, phaseIndex: 3, week: 35 });
    expect(planProgramFor(profile, '2026-10-01')).toBe(pid(0));
    expect(planProgramFor(profile, '2027-01-18')).toBe(pid(2));
    expect(planProgramFor({ ...profile, plan: undefined }, START)).toBeUndefined();
  });

  it('suivi chaque 12 du mois, d’octobre à juin', () => {
    expect(checkpoints(tpl, START)).toEqual(['2026-10-12', '2026-11-12', '2026-12-12', '2027-01-12', '2027-02-12', '2027-03-12', '2027-04-12', '2027-05-12', '2027-06-12']);
    // Départ un 31 : dernier jour des mois plus courts.
    expect(checkpoints(tpl, '2026-08-31').slice(0, 3)).toEqual(['2026-08-31', '2026-09-30', '2026-10-31']);
  });

  it('séances de la semaine : A-B-A puis B-A-B en phase 1, A-B-C en phase 2', () => {
    const names = (w: number) => weekSessions(tpl, w).map((x) => `${x.day} ${x.name}`).join(', ');
    expect(names(1)).toBe('lundi A, mercredi B, vendredi A');
    expect(names(2)).toBe('lundi B, mercredi A, vendredi B');
    expect(names(3)).toBe('lundi A, mercredi B, vendredi A');
    expect(names(7)).toBe('lundi A, mercredi B, vendredi C');
    expect(names(15)).toBe('lundi Haut, mercredi Bas, vendredi Métabolique');
    expect(names(25)).toBe('lundi Haut lourd, mercredi Bas lourd, vendredi Congestion');
    expect(shortSessionName('Séance B – tirage et chaîne postérieure')).toBe('B');
  });

  it('S11–S12 tombent pendant les fêtes', () => {
    expect(holidayWeeks(tpl, START)).toEqual([11, 12]);
  });

  it('départ un mercredi : semaines du mercredi au mardi, séances mercredi, vendredi, lundi', () => {
    const WED = '2026-10-14';
    expect(weekSpan(WED)).toBe('du mercredi au mardi');
    expect(weekSpan(START)).toBe('du lundi au dimanche');
    const names = (w: number) => weekSessions(tpl, w, WED).map((x) => `${x.day} ${x.name}`).join(', ');
    expect(names(1)).toBe('mercredi A, vendredi B, lundi A');
    expect(names(2)).toBe('mercredi B, vendredi A, lundi B');
    expect(names(15)).toBe('mercredi Haut, vendredi Bas, lundi Métabolique');
    // Départ un jour sans séance : la semaine commence à la séance suivante.
    expect(sessionDaysFrom(tpl, '2026-10-13')).toEqual(['mercredi', 'vendredi', 'lundi']); // mardi
    expect(sessionDaysFrom(tpl, '2026-10-15')).toEqual(['vendredi', 'lundi', 'mercredi']); // jeudi
    expect(sessionDaysFrom(tpl, '2026-10-18')).toEqual(['lundi', 'mercredi', 'vendredi']); // dimanche
    // Lundi 19 octobre = fin de la semaine 1 ; la semaine 2 commence le mercredi 21.
    expect(planWeek(WED, '2026-10-20')).toBe(1);
    expect(planWeek(WED, '2026-10-21')).toBe(2);
  });

  it('semaine type recalée sur le jour du départ', () => {
    expect(weekTypeFrom(tpl, START)).toEqual(tpl.weekType);
    const rows = weekTypeFrom(tpl, '2026-10-14').rows;
    expect(rows.map((r) => r[0])).toEqual(['Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche', 'Lundi', 'Mardi']);
    expect(rows[0][1]).toMatch(/^1re séance de la semaine \+ 10–15 min de marche/);
    expect(rows[0][2]).toBe('Séance Haut');
    expect(rows[2].slice(1)).toEqual(['2e séance de la semaine', 'Séance Bas']);
    expect(rows[5].slice(1)).toEqual(['3e séance de la semaine', 'Séance métabolique ou congestion']);
    expect(rows[1]).toEqual(tpl.weekType.rows[3]); // jeudi : marche, inchangé
  });
});

describe('ajustements automatiques des séances', () => {
  it('2 séries en S1–S2, 3 ensuite ; semaines allégées S14 et S24', () => {
    expect(planAdjust(profile, pid(0), '2026-10-13')).toMatchObject({ maxSets: 2 });
    expect(planAdjust(profile, pid(0), '2026-10-10')).toMatchObject({ maxSets: 2 }); // avant le départ : comme S1
    expect(planAdjust(profile, pid(0), '2026-10-26')).toBeUndefined(); // S3
    expect(planAdjust(profile, pid(1), '2027-01-11')).toMatchObject({ deload: true }); // S14
    expect(planAdjust(profile, pid(1), '2027-01-04')).toBeUndefined(); // S13
    expect(planAdjust(profile, pid(2), '2027-03-22')).toMatchObject({ deload: true }); // S24
    expect(planAdjust(profile, 'ppl_6', '2026-10-13')).toBeUndefined();
    expect(planAdjust({ ...profile, plan: undefined }, pid(0), '2026-10-13')).toBeUndefined();
  });

  it('semaine allégée : une série de moins et charges −10 % arrondies à l’incrément', () => {
    const sets = [80, 80, 80].map((weight) => ({ weight, reps: 10, done: false }));
    expect(adjustSets('m_chest_press', sets, { deload: true, label: '' }).map((s) => s.weight)).toEqual([70, 70]); // 72 → 70 (pas de 5 kg)
    expect(adjustSets('db_bench', sets, { deload: true, label: '' }).map((s) => s.weight)).toEqual([72, 72]);
    expect(adjustSets('bench', sets, { maxSets: 2, label: '' })).toHaveLength(2);
    expect(adjustSets('bench', sets, undefined)).toBe(sets);
  });
});

describe('objectif et suivi', () => {
  it('118 → 93 kg sous 20 % : ~810 kcal/jour sur 34 semaines, ~1 060 sur 6 mois, 4,6 kg de masse maigre perdables', () => {
    const g = goalMath({ weightKg: 118, leanKg: 79 }, { weightKg: 93, bodyFatPct: 20 }, 34);
    expect(g.targetFatKg).toBeCloseTo(18.6, 5);
    expect(g.minLeanKg).toBeCloseTo(74.4, 5);
    expect(g.maxLeanLossKg).toBeCloseTo(4.6, 5);
    expect(g.toLoseKg).toBe(25);
    expect(Math.round(g.deficitPlan)).toBe(809);
    expect(g.ratePlan).toBeCloseTo(0.735, 3);
    expect(Math.round(g.deficit6m)).toBe(1058);
  });

  it('poids prévu en ligne droite et tableau rempli depuis les pesées et séances', () => {
    expect(expectedWeight(START, '2027-06-06', 118, 93, START)).toBe(118);
    expect(expectedWeight(START, '2027-06-06', 118, 93, '2027-06-06')).toBe(93);
    expect(expectedWeight(START, '2027-06-06', 118, 93, '2026-01-01')).toBe(118);
    const workouts: Workout[] = [
      { id: 'w', date: '2026-11-05T17:00:00.000Z', dayName: 'Séance A', finished: true, exercises: [{ exerciseId: 'leg_press', sets: [{ weight: 120, reps: 12, done: true }, { weight: 140, reps: 8, done: false }] }] },
    ];
    const body = [
      { id: 'a', date: '2026-10-08', weightKg: 118.4 },
      { id: 'b', date: '2026-10-11', weightKg: 117.6, waistCm: 121 },
      { id: 'c', date: '2026-11-10', weightKg: 115.2, bodyFatPct: 31.5 },
    ];
    const rows = trackingRows(tpl, START, { profile, body, workouts, startKg: 118, targetKg: 93 }, '2026-11-20');
    expect(rows[0]).toMatchObject({ date: START, avgKg: 118, waistCm: 121, future: false });
    expect(rows[1]).toMatchObject({ date: '2026-11-12', avgKg: 115.2, bodyFatPct: 31.5 });
    expect(rows[1].lifts[0]).toMatchObject({ label: 'Presse', set: { weight: 120, reps: 12 } }); // la série non validée est ignorée
    expect(rows[1].lifts[1].set).toBeUndefined();
    expect(rows[2]).toMatchObject({ date: '2026-12-12', future: true, avgKg: undefined });
  });
});

describe('plan appliqué au profil', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T10:00:00'));
    useStore.getState().reset();
    useStore.setState({ body: [{ id: 'b', date: '2026-10-09', weightKg: 118, bodyFatPct: 33 }], profile: { ...DEFAULT_PROFILE, daysPerWeek: 5, goal: 'recomp', level: 'intermediate' } });
  });
  afterEach(() => vi.useRealTimers());

  it('applique le profil, les cibles et active la phase 1', () => {
    useStore.getState().applyPlan(tpl.id, START, { weightKg: 93, bodyFatPct: 20 });
    const s = useStore.getState();
    expect(s.profile).toMatchObject({ plan: { id: tpl.id, start: START }, goal: 'cut', level: 'beginner', daysPerWeek: 3, sessionMinutes: 60, equipment: 'full_gym' });
    expect(s.profile).toMatchObject({ targetWeightKg: 93, targetBodyFatPct: 20, targetStartKg: 118, targetSetAt: '2026-10-10', targetStartBfPct: 33 });
    expect(s.activeProgramId).toBe(pid(0));
    expect(s.nextDayIndex).toBe(0);
    // Le plan est gardé par la validation (synchro, import) ; un plan malformé est écarté.
    expect(sanitizeProfile(s.profile).plan).toEqual({ id: tpl.id, start: START });
    expect(sanitizeProfile({ ...s.profile, plan: { id: '<script>', start: 'demain' } as never }).plan).toBeUndefined();
  });

  it('séance de S1 : 2 séries par exercice dès le pré-remplissage', () => {
    const st = useStore.getState();
    st.applyPlan(tpl.id, START, { weightKg: 93, bodyFatPct: 20 });
    vi.setSystemTime(new Date('2026-10-12T18:00:00'));
    const program = useStore.getState();
    const p1 = { ...tpl.phases[0], id: pid(0) };
    program.startWorkout({ id: pid(0), name: 'P1', author: '', description: '', level: ['beginner'], goals: ['cut'], daysPerWeek: 2, progression: '', days: p1.days }, 0);
    const w = useStore.getState().activeWorkout!;
    expect(w.exercises.map((e) => e.sets.length)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(w.exercises[0].target).toMatchObject({ sets: 2, repMin: 12, repMax: 15 });
  });

  it('passe tout seul à la phase suivante, sauf si un autre programme a été choisi', () => {
    const st = useStore.getState();
    st.applyPlan(tpl.id, START, { weightKg: 93, bodyFatPct: 20 });
    st.syncPlanPhase('2026-11-23');
    expect(useStore.getState().activeProgramId).toBe(pid(1));
    useStore.getState().activateProgram('ppl_6');
    useStore.getState().syncPlanPhase('2027-01-18');
    expect(useStore.getState().activeProgramId).toBe('ppl_6');
  });

  it('changer la date de début recale semaines et phase sans toucher aux objectifs', () => {
    const st = useStore.getState();
    st.applyPlan(tpl.id, START, { weightKg: 93, bodyFatPct: 20 });
    const before = useStore.getState().profile;
    useStore.getState().setPlanStart('2026-10-14');
    const after = useStore.getState().profile;
    expect(after.plan).toEqual({ id: tpl.id, start: '2026-10-14' });
    expect(after).toMatchObject({ targetWeightKg: 93, targetBodyFatPct: 20, targetStartKg: before.targetStartKg, targetSetAt: before.targetSetAt });
    // Mardi 27 octobre : S3 avec un départ le lundi 12, encore S2 (2 séries) avec un départ le mercredi 14.
    expect(planStatus({ ...after, plan: { id: tpl.id, start: START } }, '2026-10-27')!.week).toBe(3);
    expect(planStatus(after, '2026-10-27')!.week).toBe(2);
    expect(planAdjust(after, pid(0), '2026-10-27')?.maxSets).toBe(2);
    // Date invalide : ignorée.
    useStore.getState().setPlanStart('mercredi');
    expect(useStore.getState().profile.plan?.start).toBe('2026-10-14');
  });

  it('reculer le départ ramène à la phase du jour quand on suit le plan', () => {
    useStore.getState().applyPlan(tpl.id, START, { weightKg: 93, bodyFatPct: 20 });
    vi.setSystemTime(new Date('2026-11-24T10:00:00')); // S7 : phase 2
    useStore.getState().syncPlanPhase('2026-11-24');
    expect(useStore.getState().activeProgramId).toBe(pid(1));
    useStore.getState().setPlanStart('2026-11-04'); // S3 : phase 1
    expect(useStore.getState().activeProgramId).toBe(pid(0));
  });

  it('retirer le plan arrête le suivi et désactive son programme', () => {
    useStore.getState().applyPlan(tpl.id, START, { weightKg: 93, bodyFatPct: 20 });
    useStore.getState().removePlan();
    const s = useStore.getState();
    expect(s.profile.plan).toBeUndefined();
    expect(s.activeProgramId).toBeUndefined();
    expect(s.profile.targetWeightKg).toBe(93); // l'objectif de poids reste
  });
});
