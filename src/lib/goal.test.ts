import { describe, expect, it } from 'vitest';
import { goalProjection } from './goal';

const base = { today: '2026-10-03', startKg: 117.7, targetKg: 100 };

describe('goalProjection', () => {
  it('estime la date d’arrivée au rythme actuel', () => {
    const p = goalProjection({ ...base, currentKg: 115, ratePerWeek: -0.75 });
    expect(p.status).toBe('on_track');
    expect(p.remainingKg).toBe(15);
    expect(p.weeks).toBe(20);
    expect(p.eta).toBe('2027-02-20');
    expect(p.progressPct).toBe(15);
  });

  it('découpe le chemin en paliers de 5 kg, du plus proche au plus lointain', () => {
    const p = goalProjection({ ...base, currentKg: 114, ratePerWeek: -1 });
    expect(p.milestones.map((m) => m.kg)).toEqual([115, 110, 105, 100]);
    expect(p.milestones[0].reached).toBe(true);
    expect(p.milestones[1]).toMatchObject({ reached: false, eta: '2026-10-31' });
  });

  it('signale une tendance inverse, stable ou inconnue', () => {
    expect(goalProjection({ ...base, currentKg: 116, ratePerWeek: 0.4 }).status).toBe('wrong_way');
    expect(goalProjection({ ...base, currentKg: 116, ratePerWeek: 0.01 }).status).toBe('flat');
    expect(goalProjection({ ...base, currentKg: 116 }).status).toBe('unknown');
  });

  it('objectif atteint, et prise de masse', () => {
    expect(goalProjection({ ...base, currentKg: 99.5, ratePerWeek: -0.5 })).toMatchObject({ status: 'reached', remainingKg: 0, progressPct: 100 });
    const bulk = goalProjection({ today: '2026-10-03', startKg: 70, targetKg: 75, currentKg: 71, ratePerWeek: 0.25 });
    expect(bulk).toMatchObject({ status: 'on_track', remainingKg: 4, weeks: 16 });
  });

  it('prévient au-delà de 1 % du poids perdu par semaine', () => {
    expect(goalProjection({ ...base, currentKg: 115, ratePerWeek: -1.4 }).tooFast).toBe(true);
    expect(goalProjection({ ...base, currentKg: 115, ratePerWeek: -0.9 }).tooFast).toBe(false);
  });
});
