import { describe, expect, it } from 'vitest';
import { cardioStats, dailyTotals, isValidCardio, strideM } from './cardio';
import { DEFAULT_PROFILE } from './store';

const profile = { ...DEFAULT_PROFILE, sex: 'male' as const, heightCm: 180 };

describe('marche sur tapis', () => {
  it('calcule tout à partir de la vitesse, de la durée et de l’inclinaison (équation ACSM)', () => {
    const flat = cardioStats({ id: 'a', date: '2026-10-01', inclinePct: 0, durationMin: 60, speedKmh: 5 }, profile, 80);
    const hill = cardioStats({ id: 'b', date: '2026-10-01', inclinePct: 10, durationMin: 60, speedKmh: 5 }, profile, 80);
    expect(flat.kcal).toBe(200);
    expect(hill.kcal).toBe(560);
    expect(hill.distanceKm).toBe(5);
    expect(hill.elevationM).toBe(500);
    expect(hill.steps).toBe(Math.round(5000 / strideM(profile)));
    expect(hill.stepsEstimated).toBe(true);
    expect(hill.estimated).toBe(false);
  });

  it('accepte encore le nombre de pas seul', () => {
    const s = cardioStats({ id: 'c', date: '2026-10-01', steps: 11000, inclinePct: 5 }, profile, 80);
    expect(s.distanceKm).toBeCloseTo(8.22, 1);
    expect(s.durationMin).toBe(100);
    expect(s.estimated).toBe(true);
    expect(s.stepsEstimated).toBe(false);
  });

  it('montre : pas + durée donnent la vitesse réelle', () => {
    const s = cardioStats({ id: 'w', date: '2026-10-01', steps: 9000, durationMin: 80, inclinePct: 0 }, profile, 80);
    expect(s.distanceKm).toBeCloseTo(6.72, 1);
    expect(s.speedKmh).toBeCloseTo(5, 0);
    expect(s.elevationM).toBe(0);
    expect(s.kcal).toBeGreaterThan(200);
  });

  it('exige vitesse + durée, ou des pas', () => {
    expect(isValidCardio({ speedKmh: 5 })).toBe(false);
    expect(isValidCardio({ speedKmh: 5, durationMin: 30 })).toBe(true);
    expect(isValidCardio({ steps: 4000 })).toBe(true);
  });

  it('additionne les sessions d’un même jour', () => {
    const entries = [
      { id: '1', date: '2026-10-01', inclinePct: 8, speedKmh: 5, durationMin: 30 },
      { id: '2', date: '2026-10-01', inclinePct: 12, speedKmh: 4.5, durationMin: 20 },
    ];
    const d = dailyTotals(entries, profile, 80, 3, new Date('2026-10-01T12:00:00Z'));
    expect(d.map((x) => x.minutes)).toEqual([0, 0, 50]);
    expect(d[2].distanceKm).toBe(4);
  });
});
