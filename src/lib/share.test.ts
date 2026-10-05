import { describe, expect, it } from 'vitest';
import { buildShare, mergeSeries, parseShare } from './share';
import { DEFAULT_PROFILE } from './store';
import type { Workout } from './types';

const user = { login: 'vincent', name: 'Vincent', avatarUrl: '' };
const wk = (id: string, date: string, weight: number): Workout => ({
  id,
  date,
  dayName: 'Haut A',
  finished: true,
  exercises: [{ exerciseId: 'bench', sets: [{ weight, reps: 5, done: true }] }],
  note: 'note privée',
});
const state = {
  profile: DEFAULT_PROFILE,
  workouts: [wk('a', '2026-09-01T18:00:00Z', 80), wk('b', '2026-09-08T18:00:00Z', 82.5)],
  body: [{ id: 'x', date: '2026-09-01', weightKg: 80, bodyFatPct: 18, waistCm: 85 }],
  friends: ['alex'],
  share: { enabled: true, body: false },
};

describe('partage public', () => {
  it('ne publie ni le corps (si non choisi) ni les notes', () => {
    const p = buildShare(state, user, new Date('2026-09-10'));
    expect(p.lifts.bench.map((x) => x.e1rm)).toEqual([93.3, 96.3]);
    expect(p.body).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain('note privée');
    expect(JSON.stringify(p)).not.toContain('waist');
    // La liste d'amis n'est plus publiée en clair (seulement des empreintes, ajoutées à la publication).
    expect(p.friends).toEqual([]);
    expect(JSON.stringify(p)).not.toContain('alex');
    // Jour seulement, pas l'heure de la séance.
    expect(p.recent.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true);
  });

  it('publie une valeur de poids par semaine si autorisé', () => {
    const p = buildShare({ ...state, share: { enabled: true, body: true } }, user, new Date('2026-09-10'));
    expect(p.body).toEqual([{ date: '2026-09-01', weight: 80, bf: 18, muscle: undefined }]);
  });

  it('rejette un partage invalide', () => {
    expect(parseShare('{"app":"autre"}')).toBeUndefined();
    // L'identité écrite dans le fichier d'un tiers n'est jamais reprise (elle vient de l'API GitHub).
    expect(parseShare(JSON.stringify(buildShare(state, user)))?.user.login).toBe('');
    expect(parseShare(JSON.stringify(buildShare(state, user)))?.lifts.bench).toHaveLength(2);
  });

  it('neutralise un partage piégé sans planter', () => {
    const evil = {
      app: 'new-shape-share',
      user: { login: 'torvalds', name: 'Usurpé', avatarUrl: 'https://evil.example/x.png' },
      profile: { goal: '__proto__', level: 'god', daysPerWeek: 'x' },
      stats: { workouts: { a: 1 }, lastWorkout: '<script>' },
      lifts: { bench: [{ date: 'x', e1rm: '<b>' }, { date: '2026-09-01', e1rm: 100 }], squat: 'pas un tableau', __proto__: [{ date: '2026-01-01', e1rm: 1 }], 'a b': [] },
      weekly: [{ week: 1, sessions: '9' }, 'n', { week: '2026-09-01', sessions: 3, tonnage: 5000 }],
      recent: [{ date: '2026-09-01T10:00:00Z', dayName: { x: 1 }, top: 'non' }, { date: 5 }],
      friends: ['ok-login', { x: 1 }, 'mauvais login!'],
    };
    const p = parseShare(JSON.stringify(evil))!;
    expect(p.user.login).toBe('');
    expect(p.profile).toEqual({ goal: 'recomp', level: 'intermediate', sex: 'male', daysPerWeek: 3 });
    expect(p.stats).toEqual({ workouts: 0, since: undefined, lastWorkout: undefined });
    expect(Object.keys(p.lifts)).toEqual(['bench']);
    expect(p.lifts.bench).toEqual([{ date: '2026-09-01', e1rm: 100 }]);
    expect(Object.getPrototypeOf(p.lifts)).toBe(Object.prototype);
    expect(p.weekly).toEqual([{ week: '2026-09-01', sessions: 3, tonnage: 5000 }]);
    expect(p.recent).toEqual([{ date: '2026-09-01', dayName: 'Séance', durationMin: undefined, tonnage: 0, top: [] }]);
    // La liste d'amis d'un tiers n'est jamais reprise.
    expect(p.friends).toEqual([]);
    expect(parseShare('x'.repeat(600 * 1024))).toBeUndefined();
  });
});

describe('comparaison', () => {
  it('exprime chaque courbe en % depuis son départ', () => {
    const m = mergeSeries(
      [{ date: '2026-09-01', value: 100 }, { date: '2026-09-08', value: 110 }],
      [{ date: '2026-09-02', value: 60 }, { date: '2026-09-08', value: 63 }],
      true,
    );
    expect(m).toEqual([
      { date: '2026-09-01', me: 0 },
      { date: '2026-09-02', friend: 0 },
      { date: '2026-09-08', me: 10, friend: 5 },
    ]);
  });
});
