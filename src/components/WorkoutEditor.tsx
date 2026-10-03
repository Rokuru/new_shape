import { useState } from 'react';
import { EXERCISES, getExercise, MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { localDate } from '../lib/dates';
import { uid, useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import type { LoggedExercise, LoggedSet, Workout } from '../lib/types';
import NumField from './NumField';
import Sheet from './Sheet';
import { fmtDate, Icon } from './ui';

/** Remplace le jour d'une date ISO en gardant l'heure locale de la séance. */
export function withDay(iso: string, day: string): string {
  const d = new Date(iso);
  const [y, m, dd] = day.split('-').map(Number);
  d.setFullYear(y, m - 1, dd);
  return d.toISOString();
}

/** Modification d'une séance terminée : date, durée, séries (charge, reps, RIR), exercices, note. */
export default function WorkoutEditor({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const updateWorkout = useStore((s) => s.updateWorkout);
  const todayKey = useToday();
  // Seules les séries validées comptent dans une séance terminée : on n'édite que celles-là.
  const [exercises, setExercises] = useState<LoggedExercise[]>(() =>
    workout.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done).map((s) => ({ ...s })) })).filter((e) => e.sets.length),
  );
  const [day, setDay] = useState(localDate(new Date(workout.date)));
  const [duration, setDuration] = useState(workout.durationMin ?? 0);
  const [note, setNote] = useState(workout.note ?? '');
  const [adding, setAdding] = useState('');
  const [err, setErr] = useState('');

  const setEx = (i: number, fn: (e: LoggedExercise) => LoggedExercise) => setExercises((xs) => xs.map((e, j) => (j === i ? fn(e) : e)));
  const setSet = (i: number, k: number, patch: Partial<LoggedSet>) => setEx(i, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) }));

  const save = () => {
    if (!day) return setErr('Choisis une date.');
    if (day > todayKey) return setErr('La date est dans le futur : choisis aujourd’hui ou un jour passé.');
    const kept = exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.reps > 0) })).filter((e) => e.sets.length);
    if (!kept.length) return setErr('Il faut au moins une série avec des répétitions (ou supprime la séance).');
    updateWorkout({ ...workout, date: withDay(workout.date, day), durationMin: duration || undefined, note: note.trim() || undefined, exercises: kept });
    onClose();
  };

  return (
    <Sheet title={workout.dayName} kicker="Modifier la séance" onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          Date
          <input type="date" value={day} max={todayKey} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="field">
          Durée (min)
          <NumField value={duration} max={600} decimals={0} onChange={setDuration} />
        </label>
      </div>

      {exercises.map((ex, i) => {
        const info = getExercise(ex.exerciseId);
        return (
          <div key={i} className="edit-ex">
            <div className="spread">
              <h3 style={{ margin: 0 }}>{info.name}</h3>
              <button className="btn ghost sm" aria-label={`Retirer ${info.name}`} onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}>
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="set-row head">
              <span>#</span>
              <span>kg</span>
              <span>reps</span>
              <span>RIR</span>
              <span />
            </div>
            {ex.sets.map((s, k) => (
              <div className="set-row" key={k}>
                <span className="muted small">{k + 1}</span>
                <NumField aria-label={`${info.name} : charge série ${k + 1}`} value={s.weight} max={999} decimals={2} onChange={(weight) => setSet(i, k, { weight })} />
                <NumField aria-label={`${info.name} : répétitions série ${k + 1}`} value={s.reps} max={999} decimals={0} onChange={(reps) => setSet(i, k, { reps })} />
                <select aria-label={`${info.name} : RIR série ${k + 1}`} value={s.rir ?? ''} onChange={(e) => setSet(i, k, { rir: e.target.value === '' ? undefined : Number(e.target.value) })}>
                  <option value="">–</option>
                  {[0, 1, 2, 3, 4].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button className="btn ghost sm" aria-label={`Supprimer la série ${k + 1}`} onClick={() => setEx(i, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== k) }))}>
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => setEx(i, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { weight: 0, reps: 10 }), done: true }] }))}>
              <Icon name="plus" size={16} /> Série
            </button>
          </div>
        );
      })}

      <label className="field" style={{ marginTop: 12 }}>
        Ajouter un exercice
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <select value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choisir…</option>
            {MUSCLES.map((m) => (
              <optgroup key={m} label={MUSCLE_LABELS[m]}>
                {EXERCISES.filter((e) => e.primary[0] === m).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            className="btn"
            disabled={!adding}
            aria-label="Ajouter l’exercice"
            onClick={() => {
              setExercises((xs) => [...xs, { exerciseId: adding, sets: [{ weight: 0, reps: 10, done: true }] }]);
              setAdding('');
            }}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </label>

      <label className="field" style={{ marginTop: 12 }}>
        Notes
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={save}>
          Enregistrer
        </button>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Séance du {fmtDate(workout.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Les records et suggestions de charge se recalculent automatiquement.
      </p>
    </Sheet>
  );
}

/** Copie d'une séance terminée à une autre date (ou le même jour), ouverte ensuite pour ajustement. */
export function DuplicateWorkout({ workout, onClose, onCopied }: { workout: Workout; onClose: () => void; onCopied: (id: string) => void }) {
  const addWorkout = useStore((s) => s.addWorkout);
  const todayKey = useToday();
  const [day, setDay] = useState(todayKey);
  const [edit, setEdit] = useState(true);
  const [err, setErr] = useState('');
  const source = localDate(new Date(workout.date));

  const copy = () => {
    if (!day) return setErr('Choisis une date.');
    if (day > todayKey) return setErr('La date est dans le futur : choisis aujourd’hui ou un jour passé.');
    const id = uid();
    addWorkout({
      ...workout,
      id,
      date: withDay(workout.date, day),
      finished: true,
      exercises: workout.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done).map((s) => ({ ...s })) })).filter((e) => e.sets.length),
    });
    onClose();
    if (edit) onCopied(id);
  };

  return (
    <Sheet title={workout.dayName} kicker="Dupliquer la séance" onClose={onClose}>
      <p className="small secondary" style={{ marginTop: 0 }}>
        Copie de la séance du {fmtDate(workout.date, { weekday: 'long', day: 'numeric', month: 'long' })} : mêmes exercices, charges et répétitions. L’original n’est pas modifié.
      </p>
      <label className="field">
        Date de la copie
        <input type="date" value={day} max={todayKey} onChange={(e) => setDay(e.target.value)} />
        {day === source && <span className="small muted">même jour que l’original</span>}
      </label>
      <label className="small" style={{ marginTop: 12, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} style={{ width: 20, height: 20, minHeight: 0, flexShrink: 0 }} />
        <span>Ouvrir la copie pour ajuster charges et répétitions</span>
      </label>
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={copy}>
          <Icon name="copy" size={16} /> Dupliquer
        </button>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Sheet>
  );
}
