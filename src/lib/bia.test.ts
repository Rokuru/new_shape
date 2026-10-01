import { describe, expect, it } from 'vitest';
import { biaTrend, metabolicAgeStatus, segmentAnalysis, visceralStatus, waterStatus } from './bia';
import { readBia } from '../components/BiaPanel';
import { DEFAULT_PROFILE } from './store';
import type { BodyEntry } from './types';

describe('balance Tanita', () => {
  it('lit le formulaire, ignore les valeurs hors plage', () => {
    const bia = readBia({ 'bia.muscleKg': '62,4', 'bia.visceral': '80', 'bia.physique': '6', 'segMuscle.armR': '3,4' });
    expect(bia).toEqual({ muscleKg: 62.4, physique: 6, segMuscle: { armR: 3.4 } });
    expect(readBia({})).toBeUndefined();
  });

  it('interprète graisse viscérale, eau et âge métabolique', () => {
    expect(visceralStatus(8).level).toBe('ok');
    expect(visceralStatus(14).level).toBe('bad');
    expect(waterStatus(56, 'male').level).toBe('ok');
    expect(waterStatus(46, 'male').level).toBe('warn');
    expect(metabolicAgeStatus(25, { ...DEFAULT_PROFILE, birthYear: new Date().getFullYear() - 30 }).level).toBe('ok');
  });

  it('lisse le muscle et détecte une asymétrie bras/jambes', () => {
    const e = (date: string, armR: number, armL: number, muscleKg: number): BodyEntry => ({ id: date, date, weightKg: 80, bia: { muscleKg, segMuscle: { armR, armL, legR: 10, legL: 10 } } });
    const entries = [e('2026-09-01', 3.6, 3.2, 60), e('2026-09-08', 3.7, 3.3, 61.5)];
    expect([...biaTrend(entries, (x) => x.bia?.muscleKg).values()]).toEqual([60, 60.45]);
    const seg = segmentAnalysis(entries)!;
    expect(seg.rows.find((r) => r.key === 'armR')?.muscleDelta).toBeCloseTo(0.1);
    expect(seg.asymmetries).toHaveLength(1);
    expect(seg.asymmetries[0]).toContain('bras');
  });
});
