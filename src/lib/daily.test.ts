import { beforeEach, describe, expect, it } from 'vitest';
import { oneCheckinPerDay, sanitizeCheckin, sanitizeCollections, sanitizeFavorite } from './sanitize';
import { DEFAULT_PROFILE, useStore, type SyncedData } from './store';
import { mergeData } from './sync';
import { weeklyReport } from './weeklyReport';

describe('repas favoris', () => {
  beforeEach(() => useStore.getState().reset());

  it('ajout, remplacement du même nom sans doublon, retrait', () => {
    const s = useStore.getState();
    s.addFavorite({ id: 'a', label: 'Petit-déj', kcal: 500, proteinG: 30 });
    s.addFavorite({ id: 'b', label: 'Déjeuner', kcal: 800 });
    s.addFavorite({ id: 'c', label: 'petit-déj', kcal: 520, proteinG: 35 });
    expect(useStore.getState().foodFavorites.map((f) => f.id)).toEqual(['b', 'c']);
    // L'ancien est marqué supprimé : l'autre appareil ne le fera pas revenir.
    expect(useStore.getState().deleted).toContain('a');
    useStore.getState().removeFavorite('b');
    expect(useStore.getState().foodFavorites.map((f) => f.id)).toEqual(['c']);
    expect(useStore.getState().deleted).toContain('b');
  });

  it('validation : nom obligatoire, calories ou protéines, identifiant sûr', () => {
    expect(sanitizeFavorite({ id: 'x', label: '  Shake  ', kcal: 250.4, proteinG: 30.04 })).toEqual({ id: 'x', label: 'Shake', kcal: 250, proteinG: 30 });
    expect(sanitizeFavorite({ id: 'x', label: ' ', kcal: 250 })).toBeUndefined();
    expect(sanitizeFavorite({ id: 'x', label: 'Eau', kcal: 0 })).toBeUndefined();
    expect(sanitizeFavorite({ id: '<x>', label: 'A', kcal: 100 })).toBeUndefined();
  });
});

describe('refaire hier', () => {
  beforeEach(() => useStore.getState().reset());

  it('copie les repas de la veille : nouveaux identifiants, mêmes heures, dans l’ordre', () => {
    const y = '2026-10-18';
    const t = '2026-10-19';
    useStore.setState({
      food: [
        { id: 'f2', date: y, at: new Date(2026, 9, 18, 19, 30).toISOString(), kcal: 900, label: 'Dîner' },
        { id: 'f1', date: y, at: new Date(2026, 9, 18, 8, 0).toISOString(), kcal: 500, proteinG: 30, label: 'Petit-déj' },
      ],
    });
    useStore.getState().copyFoodDay(y, t);
    const copied = useStore.getState().food.filter((f) => f.date === t);
    expect(copied.map((f) => [f.label, new Date(f.at).getHours(), new Date(f.at).getDate()])).toEqual([
      ['Petit-déj', 8, 19],
      ['Dîner', 19, 19],
    ]);
    expect(copied.some((f) => f.id === 'f1' || f.id === 'f2')).toBe(false);
    expect(copied[0].proteinG).toBe(30);
    expect(useStore.getState().food.filter((f) => f.date === y)).toHaveLength(2); // la veille reste intacte
  });
});

describe('point du jour', () => {
  beforeEach(() => useStore.getState().reset());

  it('un par date, complété au fil des réponses', () => {
    useStore.getState().setCheckin('2026-10-19', { sleep: 4 });
    useStore.getState().setCheckin('2026-10-19', { energy: 3, note: 'Genou' });
    useStore.getState().setCheckin('2026-10-18', { sleep: 2 });
    const cs = useStore.getState().checkins;
    expect(cs.map((c) => c.date)).toEqual(['2026-10-18', '2026-10-19']);
    expect(cs[1]).toMatchObject({ sleep: 4, energy: 3, note: 'Genou' });
    useStore.getState().setCheckin('2026-10-19', { sleep: undefined }); // réponse retirée
    expect(useStore.getState().checkins[1].sleep).toBeUndefined();
  });

  it('validation : notes entières de 1 à 5, une seule par date', () => {
    expect(sanitizeCheckin({ id: 'c', date: '2026-10-19', sleep: 4.4, energy: 9, hunger: 0, soreness: '3', note: 'ok' })).toEqual({ id: 'c', date: '2026-10-19', sleep: 4, note: 'ok' });
    expect(
      oneCheckinPerDay([
        { id: 'a', date: '2026-10-19', sleep: 1 },
        { id: 'b', date: '2026-10-19', sleep: 5 },
      ]),
    ).toEqual([{ id: 'b', date: '2026-10-19', sleep: 5 }]);
    const c = sanitizeCollections({ checkins: [{ id: 'a', date: '2026-10-19', sleep: 2 }, 'x'], foodFavorites: [{ id: 'f', label: 'Shake', kcal: 250 }, { id: 'g' }] });
    expect(c.checkins).toHaveLength(1);
    expect(c.foodFavorites).toHaveLength(1);
  });
});

describe('synchro entre appareils', () => {
  const base: SyncedData = {
    onboarded: true,
    profile: DEFAULT_PROFILE,
    body: [],
    workouts: [],
    customPrograms: [],
    activeProgramId: undefined,
    nextDayIndex: 0,
    kcalAdjust: 0,
    kcalAdjustedAt: undefined,
    deleted: [],
    friends: [],
    share: { enabled: false, body: false },
    cardio: [],
    food: [],
    foodFavorites: [],
    checkins: [],
  };

  it('favoris réunis sans ressusciter un favori retiré ; point du jour de la version la plus récente', () => {
    const phone: SyncedData = { ...base, foodFavorites: [{ id: 'f1', label: 'Shake', kcal: 250 }], checkins: [{ id: 'c1', date: '2026-10-19', sleep: 4 }], deleted: ['f0'] };
    const laptop: SyncedData = {
      ...base,
      foodFavorites: [
        { id: 'f0', label: 'Ancien', kcal: 100 },
        { id: 'f2', label: 'Riz poulet', kcal: 650 },
      ],
      checkins: [
        { id: 'c2', date: '2026-10-19', sleep: 2 },
        { id: 'c3', date: '2026-10-18', energy: 3 },
      ],
    };
    const m = mergeData(phone, laptop, true);
    expect(m.foodFavorites.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(m.checkins).toEqual([
      { id: 'c3', date: '2026-10-18', energy: 3 },
      { id: 'c1', date: '2026-10-19', sleep: 4 },
    ]);
  });
});

describe('bilan pour Claude : récupération', () => {
  const data = { profile: DEFAULT_PROFILE, body: [], workouts: [], cardio: [], food: [], kcalAdjust: 0 };

  it('tableau du point du jour et moyennes de la semaine', () => {
    const r = weeklyReport(
      {
        ...data,
        checkins: [
          { id: 'a', date: '2026-10-12', sleep: 4, energy: 3, hunger: 2, soreness: 3, note: 'Bien | dormi' },
          { id: 'b', date: '2026-10-14', sleep: 2, energy: 2 },
          { id: 'c', date: '2026-10-20', sleep: 5 }, // semaine suivante
        ],
      },
      '2026-10-12',
      '2026-10-19',
    ).replace(/[  ]/g, ' ');
    expect(r).toContain('## Récupération (point du jour, de 1 à 5)');
    expect(r).toContain('| lun. 12 oct. | 4 | 3 | 2 | 3 | Bien / dormi |');
    expect(r).toContain('| mer. 14 oct. | 2 | 2 | — | — |  |');
    expect(r).toContain('- Moyennes : sommeil 3 · énergie 2,5 · faim 2 · courbatures 3 (2 jours notés sur 7).');
    expect(r).toContain("d'après mon point du jour et mes notes");
    expect(weeklyReport(data, '2026-10-12', '2026-10-19')).toContain('Aucun point du jour noté cette semaine.');
  });
});
