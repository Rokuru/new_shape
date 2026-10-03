import { beforeEach, describe, expect, it } from 'vitest';
import { safeUrl, sanitizeCollections, sanitizeProgram } from './sanitize';
import { DEFAULT_PROFILE, exportData, sanitizeProfile, useStore } from './store';

describe('validation des données importées / synchronisées', () => {
  beforeEach(() => useStore.getState().reset());

  it('écarte les entrées invalides d’un fichier piégé sans planter', () => {
    const evil = {
      profile: { ...DEFAULT_PROFILE, name: { x: 1 }, sex: 'robot', goal: 42, priorities: ['chest', '__proto__'] },
      body: [{ id: 'x', date: 'demain', weightKg: '80' }, { id: 'y', date: '2026-09-01', weightKg: -3 }, null, 42, { id: 'ok', date: '2026-09-02', weightKg: 90, bia: 'oui', waistCm: 'large' }],
      workouts: [{ id: 'w1', date: 'nope', exercises: 'non' }, { id: 'w2', date: '2026-09-02T10:00:00Z', dayName: 7, finished: true, exercises: [{ exerciseId: 'bench', sets: [{ weight: '100', reps: 1e9, done: true }, 'x'] }] }],
      customPrograms: [{ id: 'p1', name: 'Piégé', days: [{ name: 'J', exercises: [{ exerciseId: 'bench', sets: -4, repMin: 'a' }] }], sources: [{ label: 'Clique', url: 'javascript:alert(1)' }, { label: 'OK', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }] }],
      cardio: 'non',
      food: [{ id: 'f', date: '2026-10-03', kcal: 'beaucoup' }, { id: 'g', date: '2026-10-03', kcal: 650, proteinG: 45.5, label: 'Déjeuner' }],
      friends: [{ a: 1 }, 'ok-login', 'pas valide!'],
      share: { enabled: 'yes' },
    };
    useStore.getState().importData(evil);
    const s = useStore.getState();
    expect(s.profile.name).toBe('');
    expect(s.profile.sex).toBe('male');
    expect(s.profile.goal).toBe(DEFAULT_PROFILE.goal);
    expect(s.profile.priorities).toEqual(['chest']);
    expect(s.body.map((b) => b.id)).toEqual(['ok']);
    expect(s.body[0].waistCm).toBeUndefined();
    expect(s.workouts).toHaveLength(1);
    expect(s.workouts[0].dayName).toBe('Séance');
    expect(s.workouts[0].exercises[0].sets).toEqual([{ weight: 0, reps: 1000, done: true }]);
    expect(s.customPrograms[0].days[0].exercises[0]).toMatchObject({ sets: 1, repMin: 8, repMax: 8 });
    expect(s.customPrograms[0].sources).toEqual([{ label: 'OK', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }]);
    expect(s.cardio).toEqual([]);
    expect(s.food.map((f) => f.id)).toEqual(['g']);
    expect(s.friends).toEqual(['ok-login']);
    expect(s.share).toEqual({ enabled: false, body: false });
  });

  it('un fichier importé ne peut pas activer le partage public', () => {
    useStore.getState().importData({ profile: DEFAULT_PROFILE, body: [], workouts: [], share: { enabled: true, body: true } });
    expect(useStore.getState().share).toEqual({ enabled: false, body: false });
  });

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => useStore.getState().importData([])).toThrow();
    expect(() => useStore.getState().importData({ profile: 'x', body: [], workouts: [] })).toThrow();
  });

  it('export puis import : aucune donnée valide perdue', () => {
    const st = useStore.getState();
    st.importData({
      profile: { ...DEFAULT_PROFILE, name: 'Rokuru', heightCm: 182, targetWeightKg: 90, targetStartKg: 117.7, targetSetAt: '2026-10-03', targetBodyFatPct: 20, bmrMethod: 'katch' },
      body: [{ id: 'b1', date: '2026-10-02', weightKg: 117.7, bodyFatPct: 33.2, note: 'matin', bia: { muscleKg: 74.8, waterPct: 46.4, visceral: 15, segFat: { armR: 32.3 }, segMuscle: { trunk: 39.2 } } }],
      workouts: [{ id: 'w1', date: '2026-09-30T17:00:00.000Z', dayName: 'Séance A', programId: 'p1', durationMin: 60, note: 'top', finished: true, stretches: [{ id: 'st_cobra', done: true }], exercises: [{ exerciseId: 'bench', target: { exerciseId: 'bench', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150 }, sets: [{ weight: 72.5, reps: 8, rir: 2, done: true }] }] }],
      customPrograms: [{ id: 'p1', name: 'Perso', author: 'Moi', description: 'd', level: ['intermediate'], goals: ['cut'], daysPerWeek: 1, progression: 'p', custom: true, days: [{ name: 'A', exercises: [{ exerciseId: 'bench', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150 }], stretches: ['st_cobra'] }] }],
      cardio: [{ id: 'c1', date: '2026-10-01', inclinePct: 2, speedKmh: 2.3, durationMin: 99 }],
      food: [{ id: 'f1', date: '2026-10-03', at: '2026-10-03T12:00:00.000Z', kcal: 650, proteinG: 45.5, label: 'Déjeuner' }],
      friends: ['alex'],
      deleted: ['old'],
      share: { enabled: true, body: false },
      activeProgramId: 'p1',
      nextDayIndex: 1,
      kcalAdjust: -100,
      kcalAdjustedAt: '2026-09-20',
    });
    const first = JSON.parse(exportData());
    useStore.getState().reset();
    useStore.getState().importData(first);
    const second = JSON.parse(exportData());
    delete first.exportedAt;
    delete second.exportedAt;
    expect(second).toEqual(first);
    expect(second.workouts[0].exercises[0].sets[0].weight).toBe(72.5);
    expect(second.profile.targetBodyFatPct).toBe(20);
  });

  it('liens : https uniquement', () => {
    expect(safeUrl('https://example.org/a')).toBe('https://example.org/a');
    for (const u of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'http://example.org', ' javascript:x', 42]) expect(safeUrl(u)).toBeUndefined();
    expect(sanitizeProgram({ id: 'x', name: 'n', days: [] })).toBeUndefined();
  });

  it('profil : seuls les champs connus sont gardés', () => {
    const p = sanitizeProfile({ ...DEFAULT_PROFILE, evil: '<script>' } as never);
    expect(Object.keys(p)).not.toContain('evil');
    expect(sanitizeCollections({}).body).toEqual([]);
  });
});
