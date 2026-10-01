import { describe, expect, it } from 'vitest';
import { mergeData, parsePayload } from './sync';
import { DEFAULT_PROFILE, type SyncedData } from './store';
import type { Workout } from './types';

const w = (id: string, date: string): Workout => ({ id, date, dayName: id, exercises: [], finished: true });

const base: SyncedData = {
  onboarded: true,
  profile: DEFAULT_PROFILE,
  body: [{ id: 'b1', date: '2026-09-01', weightKg: 80 }],
  workouts: [w('w1', '2026-09-01T18:00:00Z')],
  customPrograms: [],
  activeProgramId: undefined,
  nextDayIndex: 0,
  kcalAdjust: 0,
  kcalAdjustedAt: undefined,
  deleted: [],
  friends: [],
  share: { enabled: false, body: false },
  cardio: [],
};

describe('fusion de deux appareils', () => {
  it('garde les séances et pesées ajoutées des deux côtés', () => {
    const phone = { ...base, workouts: [...base.workouts, w('w2', '2026-09-02T18:00:00Z')], nextDayIndex: 1 };
    const laptop = { ...base, body: [...base.body, { id: 'b2', date: '2026-09-02', weightKg: 79.6 }] };
    const m = mergeData(phone, laptop, true);
    expect(m.workouts.map((x) => x.id)).toEqual(['w1', 'w2']);
    expect(m.body.map((x) => x.id)).toEqual(['b1', 'b2']);
    expect(m.nextDayIndex).toBe(1);
  });

  it('ne ressuscite pas une séance supprimée sur l’autre appareil', () => {
    const phone = { ...base, workouts: [], deleted: ['w1'] };
    const m = mergeData(base, phone, false);
    expect(m.workouts).toHaveLength(0);
    expect(m.deleted).toContain('w1');
  });

  it('une seule pesée par jour : celle de la version la plus récente', () => {
    const older = { ...base, body: [{ id: 'x', date: '2026-09-03', weightKg: 79 }] };
    const newer = { ...base, body: [{ id: 'y', date: '2026-09-03', weightKg: 78.8 }] };
    expect(mergeData(newer, older, true).body.filter((b) => b.date === '2026-09-03')).toEqual([{ id: 'y', date: '2026-09-03', weightKg: 78.8 }]);
  });

  it('prend le profil de la version la plus récente', () => {
    const local = { ...base, profile: { ...DEFAULT_PROFILE, goal: 'cut' as const } };
    const remote = { ...base, profile: { ...DEFAULT_PROFILE, goal: 'bulk' as const } };
    expect(mergeData(local, remote, false).profile.goal).toBe('bulk');
    expect(mergeData(local, remote, true).profile.goal).toBe('cut');
  });
});

describe('lecture du gist', () => {
  it('rejette un contenu qui ne vient pas de l’app', () => {
    expect(parsePayload('{"foo":1}')).toBeUndefined();
    expect(parsePayload('pas du json')).toBeUndefined();
    expect(parsePayload(JSON.stringify({ app: 'new-shape', version: 1, updatedAt: 'x', data: base }))?.data.workouts).toHaveLength(1);
  });
});
