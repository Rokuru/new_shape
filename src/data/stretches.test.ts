import { describe, expect, it } from 'vitest';
import { getExercise, MUSCLES } from './exercises';
import { getStretch, STRETCHES, stretchMinutes, suggestStretches } from './stretches';
import { PROGRAMS } from './programs';

describe('étirements', () => {
  it('chaque grand groupe musculaire a au moins un étirement', () => {
    for (const m of MUSCLES) expect(STRETCHES.some((s) => s.muscles.includes(m)), m).toBe(true);
    expect(new Set(STRETCHES.map((s) => s.id)).size).toBe(STRETCHES.length);
  });

  it('suggère d’abord les muscles les plus travaillés, sans doublon', () => {
    const legs = suggestStretches(
      [
        { exerciseId: 'squat', sets: 4 },
        { exerciseId: 'leg_curl', sets: 3 },
        { exerciseId: 'calf_raise', sets: 3 },
      ],
      getExercise,
    );
    expect(legs[0]).toBe('st_hamstring_seated'); // ischios : squat (secondaire) + leg curl = la plus forte charge
    expect(legs).toContain('st_quad_standing');
    expect(legs).toContain('st_hamstring_seated');
    expect(legs).toContain('st_calf_wall');
    expect(new Set(legs).size).toBe(legs.length);
    expect(legs.length).toBeLessThanOrEqual(5);
  });

  it('chaque séance de la bibliothèque obtient des étirements valides', () => {
    for (const p of PROGRAMS)
      for (const d of p.days) {
        const ids = suggestStretches(d.exercises, getExercise);
        expect(ids.length, `${p.name} · ${d.name}`).toBeGreaterThan(0);
        for (const id of ids) expect(getStretch(id)).toBeDefined();
      }
    expect(stretchMinutes(['st_quad_standing', 'st_cobra'])).toBe(3);
  });
});
