import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween, localDate } from './dates';
import { dailyTotals } from './cardio';
import { activityAverage } from './energy';
import { bodyweightAt } from './calc';
import { DEFAULT_PROFILE } from './store';
import type { CardioEntry, Workout } from './types';

// Les tests tournent en Europe/Paris (vitest.config.ts).
const profile = { ...DEFAULT_PROFILE, heightCm: 180, sex: 'male' as const };

describe('fuseau horaire', () => {
  it('le fuseau de test est bien Europe/Paris', () => {
    expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(-120); // été UTC+2
    expect(new Date('2026-12-01T12:00:00Z').getTimezoneOffset()).toBe(-60); // hiver UTC+1
  });
});

describe('localDate', () => {
  it('00 h 30 le 2 octobre à Paris = 2 octobre (alors que UTC est encore le 1er)', () => {
    const d = new Date('2026-10-01T22:30:00Z');
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-01'); // l'ancien calcul (bug)
    expect(localDate(d)).toBe('2026-10-02');
  });
  it('1 h 59 heure d’été = jour local', () => {
    expect(localDate(new Date('2026-10-01T23:59:00Z'))).toBe('2026-10-02');
  });
  it('00 h 30 en hiver (UTC+1)', () => {
    expect(localDate(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02');
  });
  it('23 h 59 locale reste le jour même', () => {
    expect(localDate(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
  });
  it('dayKey convertit un horodatage ISO en jour local et laisse une date simple intacte', () => {
    expect(dayKey('2026-10-01T22:30:00.000Z')).toBe('2026-10-02');
    expect(dayKey('2026-10-01')).toBe('2026-10-01');
  });
});

describe('changements d’heure', () => {
  it('addDays traverse le passage à l’heure d’hiver (25 octobre 2026) sans sauter ni doubler de jour', () => {
    const days = Array.from({ length: 5 }, (_, i) => addDays('2026-10-23', i));
    expect(days).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });
  it('addDays traverse le passage à l’heure d’été (29 mars 2026)', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-03-30', -2)).toBe('2026-03-28');
  });
  it('daysBetween compte des jours calendaires malgré les journées de 23 h / 25 h', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
  });
});

describe('Marche aujourd’hui', () => {
  const walks: CardioEntry[] = [
    { id: 'a', date: '2026-10-01', speedKmh: 5, durationMin: 40, inclinePct: 0 },
    { id: 'b', date: '2026-10-02', speedKmh: 5, durationMin: 30, inclinePct: 0 },
  ];
  it('à 00 h 30 le 2 octobre, « aujourd’hui » est le 2 et pas le 1er', () => {
    const now = new Date('2026-10-01T22:30:00Z');
    const [t] = dailyTotals(walks, profile, 80, 1, now);
    expect(t.date).toBe('2026-10-02');
    expect(t.minutes).toBe(30);
  });
  it('à 1 h 59 aussi', () => {
    expect(dailyTotals(walks, profile, 80, 1, new Date('2026-10-01T23:59:00Z'))[0].date).toBe('2026-10-02');
  });
  it('14 jours consécutifs sans trou ni doublon autour du passage à l’heure d’hiver', () => {
    const days = dailyTotals([], profile, 80, 14, new Date(2026, 9, 30, 0, 30)).map((d) => d.date);
    expect(days[0]).toBe('2026-10-17');
    expect(days.at(-1)).toBe('2026-10-30');
    expect(new Set(days).size).toBe(14);
    for (let i = 1; i < days.length; i++) expect(daysBetween(days[i - 1], days[i])).toBe(1);
  });
  it('la veille au soir (23 h) : la marche du 2 n’est pas encore comptée', () => {
    const [t] = dailyTotals(walks, profile, 80, 1, new Date(2026, 9, 1, 23, 0));
    expect(t.date).toBe('2026-10-01');
    expect(t.minutes).toBe(40);
  });
});

describe('séances enregistrées après minuit', () => {
  const lateWorkout = (date: string): Workout => ({
    id: date,
    date,
    dayName: 'Full',
    finished: true,
    durationMin: 60,
    exercises: [],
  } as unknown as Workout);

  it('une séance à 00 h 30 (heure de Paris) appartient au jour local', () => {
    const body = [
      { id: '1', date: '2026-10-01', weightKg: 80 },
      { id: '2', date: '2026-10-02', weightKg: 79 },
    ];
    expect(bodyweightAt(body, '2026-10-01T22:30:00.000Z')).toBe(79);
  });

  it('activityAverage : fenêtre de 14 jours locaux, séance de 00 h 30 incluse dans le jour courant', () => {
    const now = new Date('2026-10-01T22:45:00Z'); // 00 h 45 le 2 octobre à Paris
    const workouts = Array.from({ length: 10 }, (_, i) => lateWorkout(new Date(Date.UTC(2026, 8, 18 + i * 1.5, 22, 30)).toISOString()));
    workouts.push(lateWorkout('2026-10-01T22:30:00.000Z'));
    const a = activityAverage({ workouts, cardio: [], profile }, 80, now);
    expect(a.source).toBe('history');
    expect(a.days).toBe(14);
    // La séance du 2 octobre à 00 h 30 (stockée « 2026-10-01T22:30Z ») est bien dans la fenêtre.
    const withoutLast = activityAverage({ workouts: workouts.slice(0, -1), cardio: [], profile }, 80, now);
    expect(a.training).toBeGreaterThan(withoutLast.training);
  });
});
