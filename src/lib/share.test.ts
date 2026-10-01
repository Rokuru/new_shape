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
    expect(p.friends).toEqual(['alex']);
  });

  it('publie une valeur de poids par semaine si autorisé', () => {
    const p = buildShare({ ...state, share: { enabled: true, body: true } }, user, new Date('2026-09-10'));
    expect(p.body).toEqual([{ date: '2026-09-01', weight: 80, bf: 18, muscle: undefined }]);
  });

  it('rejette un partage invalide', () => {
    expect(parseShare('{"app":"autre"}')).toBeUndefined();
    expect(parseShare(JSON.stringify(buildShare(state, user)))?.user.login).toBe('vincent');
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
