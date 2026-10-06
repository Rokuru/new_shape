import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';
import { EN_NAMES, frenchQueryName, mistakesFor, VARIANTS, videoSearchUrl } from './exerciseDetails';
import { GUIDES } from './exerciseGuide';

describe('fiches d’exercice détaillées', () => {
  it('chaque exercice a une fiche, un nom anglais et des erreurs fréquentes', () => {
    for (const e of EXERCISES) {
      expect(GUIDES[e.id], e.id).toBeDefined();
      expect(EN_NAMES[e.id], e.id).toMatch(/^[a-z0-9 ]+$/);
      expect(mistakesFor(e.id).length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('les variantes pointent vers des exercices existants, différents de l’exercice', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const [id, v] of Object.entries(VARIANTS)) {
      expect(ids.has(id), id).toBe(true);
      for (const x of [...(v.easier ?? []), ...(v.harder ?? [])]) {
        expect(ids.has(x), `${id} → ${x}`).toBe(true);
        expect(x).not.toBe(id);
      }
    }
  });

  it('recherche vidéo : nom français sans la parenthèse, adresse YouTube encodée', () => {
    expect(frenchQueryName('Presse pectoraux (Chest press)')).toBe('Presse pectoraux');
    expect(videoSearchUrl('curl & co')).toBe('https://www.youtube.com/results?search_query=curl%20%26%20co');
  });
});
