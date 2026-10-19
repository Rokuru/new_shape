import { describe, expect, it } from 'vitest';
import { foodPeriod, mondayOf } from './foodHistory';
import type { FoodEntry } from './types';

// Lundi 19 octobre 2026.
const TODAY = '2026-10-19';
let n = 0;
const meal = (date: string, kcal: number, proteinG?: number): FoodEntry => ({ id: `f${n++}`, date, at: `${date}T12:00:00.000Z`, kcal, proteinG });

describe('historique des repas', () => {
  it('lundi de la semaine', () => {
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    // Semaine à cheval sur deux mois et passage à l'heure d'hiver (25 octobre).
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
  });

  it('7 derniers jours : totaux par jour, jours vides compris, du plus récent au plus ancien', () => {
    const food = [meal(TODAY, 500, 40), meal(TODAY, 378, 53.5), meal('2026-10-18', 2042, 192.4), meal('2026-10-15', 2217), meal('2026-10-01', 1800, 120)];
    const p = foodPeriod(food, TODAY, 7, 2100);
    expect(p.days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-18', '2026-10-17', '2026-10-16', '2026-10-15', '2026-10-14', '2026-10-13']);
    expect(p.days[0]).toEqual({ date: TODAY, kcal: 878, proteinG: 93.5 });
    expect(p.days[2]).toEqual({ date: '2026-10-17', kcal: 0, proteinG: 0 });
  });

  it('moyennes : aujourd’hui (journée pas finie) et jours sans repas exclus', () => {
    const food = [meal(TODAY, 300, 20), meal('2026-10-18', 2000, 150), meal('2026-10-17', 2300, 110), meal('2026-10-16', 1900, 160)];
    const p = foodPeriod(food, TODAY, 7, 2100);
    expect(p.logged).toBe(3);
    expect(p.kcal).toBeCloseTo(2066.67, 1);
    expect(p.proteinG).toBeCloseTo(140, 5);
    expect(p.over).toBe(1);
    const empty = foodPeriod([meal(TODAY, 300)], TODAY, 7, 2100);
    expect(empty).toMatchObject({ logged: 0, over: 0 });
    expect(empty.kcal).toBeUndefined();
  });

  it('30 jours, regroupés par semaine du lundi au dimanche, avec leurs moyennes', () => {
    const food = [meal('2026-10-18', 2000, 150), meal('2026-10-12', 2400, 100), meal('2026-10-05', 1800, 140)];
    const p = foodPeriod(food, TODAY, 30, 2100);
    expect(p.days).toHaveLength(30);
    expect(p.days.at(-1)!.date).toBe('2026-09-20');
    expect(p.weeks.map((w) => [w.monday, w.days.length])).toEqual([
      ['2026-10-19', 1],
      ['2026-10-12', 7],
      ['2026-10-05', 7],
      ['2026-09-28', 7],
      ['2026-09-21', 7],
      ['2026-09-14', 1],
    ]);
    expect(p.weeks[1]).toMatchObject({ logged: 2, kcal: 2200, proteinG: 125, over: 1 });
    expect(p.weeks[2]).toMatchObject({ logged: 1, kcal: 1800, over: 0 });
    expect(p.weeks[0].logged).toBe(0);
    expect(p.weeks[0].kcal).toBeUndefined();
  });

  it('« Tout » : depuis le premier repas noté, sans compter les dates futures', () => {
    const food = [meal('2026-08-31', 2000), meal('2026-10-10', 1900), meal('2026-10-25', 2500)];
    const p = foodPeriod(food, TODAY, 'all', 2100);
    expect(p.days[0].date).toBe(TODAY);
    expect(p.days.at(-1)!.date).toBe('2026-08-31');
    expect(p.days).toHaveLength(50);
    expect(p.logged).toBe(2);
    expect(foodPeriod([], TODAY, 'all', 2100).days.map((d) => d.date)).toEqual([TODAY]);
  });
});
