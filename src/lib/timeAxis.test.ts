import { describe, expect, it } from 'vitest';
import { breakGaps, dayToTime, inRange, rangeStart, timeAxis } from './timeAxis';

const DAY = 86_400_000;

describe('axe de temps régulier', () => {
  it('espace les points selon le temps réel', () => {
    const d = inRange([{ date: '2026-01-01' }, { date: '2026-01-02' }, { date: '2026-04-02' }], 'all', '2026-10-04');
    expect((d[1].t - d[0].t) / DAY).toBe(1);
    expect((d[2].t - d[1].t) / DAY).toBe(90);
  });

  it('filtre la période choisie', () => {
    expect(rangeStart('6m', '2026-10-04')).toBe('2026-04-04');
    expect(rangeStart('1y', '2026-10-04')).toBe('2025-10-04');
    expect(rangeStart('5y', '2026-10-04')).toBe('2021-10-04');
    expect(rangeStart('all', '2026-10-04')).toBeUndefined();
    const data = ['2019-03-10', '2025-12-01', '2026-09-30'].map((date) => ({ date }));
    expect(inRange(data, '1y', '2026-10-04').map((d) => d.date)).toEqual(['2025-12-01', '2026-09-30']);
    expect(inRange(data, '5y', '2026-10-04')).toHaveLength(2);
    expect(inRange(data, 'all', '2026-10-04')).toHaveLength(3);
  });

  it('graduations à intervalle constant, au 1er du mois', () => {
    const a = timeAxis([dayToTime('2026-04-10'), dayToTime('2026-10-02')]);
    expect(a.ticks.map((t) => new Date(t).toISOString().slice(0, 10))).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
    const y = timeAxis([dayToTime('2019-02-10'), dayToTime('2026-10-02')]);
    expect(y.ticks.every((t) => new Date(t).toISOString().endsWith('-01-01T00:00:00.000Z'))).toBe(true);
    expect(y.format(y.ticks[0])).toBe('2020');
    const q = timeAxis([dayToTime('2024-02-10'), dayToTime('2026-10-02')]);
    const months = q.ticks.map((t) => new Date(t).getUTCMonth());
    expect(months.every((m) => m % 3 === 0)).toBe(true);
  });

  it('période courte : graduations hebdomadaires le lundi', () => {
    const a = timeAxis([dayToTime('2026-09-01'), dayToTime('2026-10-02')]);
    expect(a.ticks.every((t) => new Date(t).getUTCDay() === 1)).toBe(true);
    expect((a.ticks[1] - a.ticks[0]) / DAY).toBe(14);
  });
});

describe('interruptions longues', () => {
  it('coupe la courbe au-delà de 90 jours sans mesure, pas avant', () => {
    const d = inRange(['2019-01-01', '2019-02-01', '2026-04-01', '2026-06-15'].map((date) => ({ date, v: 1 })), 'all', '2026-10-04');
    const out = breakGaps(d);
    expect(out).toHaveLength(5);
    expect('v' in out[2]).toBe(false);
    expect(out[2].t).toBeGreaterThan(d[1].t);
    expect(out[2].t).toBeLessThan(d[2].t);
  });
});
