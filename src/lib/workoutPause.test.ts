import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeWorkout } from './sanitize';
import { activeMs, useStore } from './store';

const at = (hhmm: string) => vi.setSystemTime(new Date(`2026-10-14T${hhmm}:00`));
const min = (ms: number) => Math.round(ms / 60000);
/** Séance libre avec un exercice de 3 séries, dont `done` validées. */
function start(done = 0) {
  useStore.getState().startWorkout();
  useStore.getState().updateActive((w) => ({
    ...w,
    exercises: [{ exerciseId: 'leg_press', sets: [0, 1, 2].map((i) => ({ weight: 100, reps: 10, done: i < done })) }],
  }));
}
const active = () => useStore.getState().activeWorkout!;

describe('pause de la séance en cours', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at('18:00');
    useStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('lancée à la maison sans rien valider : la reprise à la salle repart de zéro', () => {
    start();
    at('18:05');
    useStore.getState().pauseWorkout();
    at('19:00');
    expect(min(activeMs(active(), Date.now()))).toBe(5); // chrono arrêté pendant la pause
    useStore.getState().resumeWorkout();
    const w = active();
    expect(w.date).toBe(new Date('2026-10-14T19:00:00').toISOString());
    expect(w.pausedAt).toBeUndefined();
    expect(w.pausedMs).toBeUndefined();
    at('19:10');
    expect(min(activeMs(active(), Date.now()))).toBe(10);
  });

  it('après des séries validées : le temps de pause ne compte pas dans la durée', () => {
    start(1);
    at('18:20');
    useStore.getState().pauseWorkout();
    at('18:25');
    useStore.getState().pauseWorkout(); // déjà en pause : rien ne bouge
    expect(active().pausedAt).toBe(new Date('2026-10-14T18:20:00').toISOString());
    at('19:00');
    useStore.getState().resumeWorkout();
    expect(min(active().pausedMs!)).toBe(40);
    expect(active().date).toBe(new Date('2026-10-14T18:00:00').toISOString());
    at('19:30');
    useStore.getState().finishWorkout();
    const done = useStore.getState().workouts.at(-1)!;
    expect(done.durationMin).toBe(50);
    expect(done.pausedAt).toBeUndefined();
    expect(done.pausedMs).toBeUndefined();
  });

  it('terminée pendant la pause : la durée s’arrête au début de la pause', () => {
    start(2);
    at('18:30');
    useStore.getState().pauseWorkout();
    at('20:00');
    useStore.getState().finishWorkout();
    expect(useStore.getState().workouts.at(-1)!.durationMin).toBe(30);
  });

  it('pause conservée au rechargement, jamais sur une séance terminée', () => {
    const base = { id: 'w1', date: '2026-10-14T16:00:00.000Z', dayName: 'Séance A', exercises: [], pausedAt: '2026-10-14T16:20:00.000Z', pausedMs: 120000 };
    expect(sanitizeWorkout({ ...base, finished: false })).toMatchObject({ pausedAt: base.pausedAt, pausedMs: 120000 });
    const finished = sanitizeWorkout({ ...base, finished: true })!;
    expect(finished.pausedAt).toBeUndefined();
    expect(finished.pausedMs).toBeUndefined();
    const bad = sanitizeWorkout({ ...base, finished: false, pausedAt: 'pas une date', pausedMs: -5 })!;
    expect(bad.pausedAt).toBeUndefined();
    expect(bad.pausedMs).toBeUndefined();
  });
});
