import { describe, expect, it } from 'vitest';
import { cardioStats, dailyTotals, strideM } from './cardio';
import { DEFAULT_PROFILE } from './store';

const profile = { ...DEFAULT_PROFILE, sex: 'male' as const, heightCm: 180 };

describe('marche sur tapis', () => {
  it('applique l’équation ACSM : l’inclinaison augmente fortement la dépense', () => {
    const flat = cardioStats({ id: 'a', date: '2026-10-01', steps: 8000, inclinePct: 0, durationMin: 60, speedKmh: 5 }, profile, 80);
    const hill = cardioStats({ id: 'b', date: '2026-10-01', steps: 8000, inclinePct: 10, durationMin: 60, speedKmh: 5 }, profile, 80);
    expect(flat.kcal).toBe(200);
    expect(hill.kcal).toBe(560);
    expect(hill.distanceKm).toBe(5);
    expect(hill.elevationM).toBe(500);
    expect(hill.estimated).toBe(false);
  });

  it('estime distance et durée à partir des pas seuls', () => {
    expect(strideM(profile)).toBeCloseTo(0.747, 3);
    const s = cardioStats({ id: 'c', date: '2026-10-01', steps: 11000, inclinePct: 5 }, profile, 80);
    expect(s.distanceKm).toBeCloseTo(8.22, 1);
    expect(s.durationMin).toBe(100);
    expect(s.estimated).toBe(true);
    expect(s.kcal).toBeGreaterThan(400);
  });

  it('additionne les sessions d’un même jour', () => {
    const entries = [
      { id: '1', date: '2026-10-01', steps: 4000, inclinePct: 8 },
      { id: '2', date: '2026-10-01', steps: 3000, inclinePct: 12 },
    ];
    const d = dailyTotals(entries, profile, 80, 3, new Date('2026-10-01T12:00:00Z'));
    expect(d.map((x) => x.steps)).toEqual([0, 0, 7000]);
  });
});
