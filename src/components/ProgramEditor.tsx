import { useState } from 'react';
import { EXERCISES, getExercise, MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { STRETCHES, suggestStretches } from '../data/stretches';
import { uid, useStore } from '../lib/store';
import type { PlannedExercise, Program, ProgramDay } from '../lib/types';
import NumField from './NumField';
import Sheet from './Sheet';
import { Icon } from './ui';

const newExercise = (exerciseId: string): PlannedExercise => {
  const ex = getExercise(exerciseId);
  return ex.kind === 'compound' ? { exerciseId, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150 } : { exerciseId, sets: 3, repMin: 10, repMax: 15, rir: 1, restSec: 90 };
};

/** Copie modifiable d'un programme (de la bibliothèque, généré ou déjà personnel). */
export function toEditable(p: Program, asCopy: boolean): Program {
  const days = p.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })), stretches: d.stretches ? [...d.stretches] : undefined }));
  return asCopy ? { ...p, id: uid(), name: `${p.name} (perso)`, author: 'Moi', custom: true, days, evidence: undefined, sources: undefined } : { ...p, days };
}

export function blankProgram(level: Program['level'][number], goal: Program['goals'][number]): Program {
  return {
    id: uid(),
    name: 'Ma séance perso',
    author: 'Moi',
    description: 'Programme personnalisé.',
    level: [level],
    goals: [goal],
    daysPerWeek: 1,
    progression: 'Double progression : quand toutes les séries atteignent le haut de la fourchette de répétitions, augmente la charge.',
    days: [{ name: 'Séance A', exercises: [] }],
    custom: true,
  };
}

function ExerciseSelect({ value, onChange, label }: { value: string; onChange: (id: string) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {!value && <option value="">Choisir…</option>}
      {/* Machines guidées des clubs (Basic-Fit : Matrix / Technogym), regroupées pour les retrouver par leur nom affiché. */}
      <optgroup label="Machines (Basic-Fit)">
        {EXERCISES.filter((e) => e.machine)
          .sort((x, y) => x.name.localeCompare(y.name, 'fr'))
          .map((e) => (
            <option key={'m-' + e.id} value={e.id}>
              {e.name}
            </option>
          ))}
      </optgroup>
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
  );
}

/** Éditeur de programme personnel : nom, séances, exercices (séries, répétitions, RIR, repos, ordre) et étirements. */
export default function ProgramEditor({ initial, isNew, onClose, onDelete }: { initial: Program; isNew: boolean; onClose: () => void; onDelete?: () => void }) {
  const { saveCustomProgram, activateProgram, activeProgramId } = useStore();
  const [p, setP] = useState(initial);
  const [activate, setActivate] = useState(isNew);
  const [adding, setAdding] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');

  const setDay = (i: number, fn: (d: ProgramDay) => ProgramDay) => setP((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? fn(d) : d)) }));
  const setEx = (i: number, k: number, patch: Partial<PlannedExercise>) => setDay(i, (d) => ({ ...d, exercises: d.exercises.map((e, j) => (j === k ? { ...e, ...patch } : e)) }));
  const move = <T,>(arr: T[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return arr;
    const a = [...arr];
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    return a;
  };

  const save = () => {
    if (!p.name.trim()) return setErr('Donne un nom au programme.');
    if (!p.days.length) return setErr('Ajoute au moins une séance.');
    const empty = p.days.find((d) => !d.exercises.length);
    if (empty) return setErr(`« ${empty.name || 'Séance'} » n’a aucun exercice.`);
    const bad = p.days.flatMap((d) => d.exercises).find((e) => !e.sets || !e.repMin || e.repMin > e.repMax);
    if (bad) return setErr(`${getExercise(bad.exerciseId).name} : au moins 1 série, et répétitions min ≤ max.`);
    // Modifié à la main : ce n'est plus le programme généré, il ne sera pas remplacé par le suivant.
    saveCustomProgram({ ...p, generated: false, name: p.name.trim(), custom: true, daysPerWeek: p.days.length, days: p.days.map((d, i) => ({ ...d, name: d.name.trim() || `Séance ${String.fromCharCode(65 + i)}` })) });
    if (activate && activeProgramId !== p.id) activateProgram(p.id);
    onClose();
  };

  return (
    <Sheet title={isNew ? 'Nouveau programme' : 'Modifier le programme'} kicker="Programme personnel" onClose={onClose}>
      <label className="field">
        Nom
        <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </label>

      {p.days.map((d, i) => {
        const auto = d.stretches === undefined;
        const stretches = d.stretches ?? suggestStretches(d.exercises, getExercise);
        return (
          <div key={i} className="edit-ex">
            <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
              <input aria-label={`Nom de la séance ${i + 1}`} value={d.name} onChange={(e) => setDay(i, (x) => ({ ...x, name: e.target.value }))} style={{ fontWeight: 700 }} />
              <button className="btn ghost sm" aria-label={`Supprimer ${d.name}`} onClick={() => confirm(`Supprimer « ${d.name} » ?`) && setP((x) => ({ ...x, days: x.days.filter((_, j) => j !== i) }))}>
                <Icon name="trash" size={16} />
              </button>
            </div>

            {d.exercises.map((e, k) => (
              <div key={k} className="pe-row">
                <div className="pe-head">
                  <ExerciseSelect value={e.exerciseId} label={`Exercice ${k + 1}`} onChange={(id) => setEx(i, k, { exerciseId: id })} />
                  <button className="btn ghost sm" aria-label="Monter" disabled={k === 0} onClick={() => setDay(i, (x) => ({ ...x, exercises: move(x.exercises, k, k - 1) }))}>
                    ↑
                  </button>
                  <button className="btn ghost sm" aria-label="Descendre" disabled={k === d.exercises.length - 1} onClick={() => setDay(i, (x) => ({ ...x, exercises: move(x.exercises, k, k + 1) }))}>
                    ↓
                  </button>
                  <button className="btn ghost sm" aria-label={`Retirer ${getExercise(e.exerciseId).name}`} onClick={() => setDay(i, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) }))}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
                <div className="pe-fields">
                  <label className="field">
                    Séries
                    <NumField value={e.sets} max={10} decimals={0} onChange={(sets) => setEx(i, k, { sets })} />
                  </label>
                  <label className="field">
                    Reps min
                    <NumField value={e.repMin} max={100} decimals={0} onChange={(repMin) => setEx(i, k, { repMin })} />
                  </label>
                  <label className="field">
                    Reps max
                    <NumField value={e.repMax} max={100} decimals={0} onChange={(repMax) => setEx(i, k, { repMax })} />
                  </label>
                  <label className="field">
                    RIR
                    <select value={e.rir} onChange={(ev) => setEx(i, k, { rir: Number(ev.target.value) })}>
                      {[0, 1, 2, 3, 4].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Repos (s)
                    <NumField value={e.restSec} max={600} decimals={0} onChange={(restSec) => setEx(i, k, { restSec })} />
                  </label>
                </div>
              </div>
            ))}

            <div className="row" style={{ flexWrap: 'nowrap', marginTop: 8 }}>
              <ExerciseSelect value={adding[i] ?? ''} label="Ajouter un exercice" onChange={(id) => setAdding({ ...adding, [i]: id })} />
              <button
                className="btn"
                disabled={!adding[i]}
                aria-label="Ajouter l’exercice"
                onClick={() => {
                  setDay(i, (x) => ({ ...x, exercises: [...x.exercises, newExercise(adding[i])] }));
                  setAdding({ ...adding, [i]: '' });
                }}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>

            <div className="pe-stretch">
              <div className="spread">
                <b className="small">Étirements de fin de séance {auto && <span className="muted">(suggérés d’après les muscles travaillés)</span>}</b>
                {!auto && (
                  <button className="btn ghost sm" onClick={() => setDay(i, (x) => ({ ...x, stretches: undefined }))}>
                    Suggestion auto
                  </button>
                )}
              </div>
              <div className="chips" style={{ marginTop: 6 }}>
                {STRETCHES.map((s) => {
                  const on = stretches.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`chip ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setDay(i, (x) => ({ ...x, stretches: on ? stretches.filter((id) => id !== s.id) : [...stretches, s.id] }))}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              {!stretches.length && <p className="small muted">Aucun étirement pour cette séance.</p>}
            </div>
          </div>
        );
      })}

      <button
        className="btn block"
        style={{ marginTop: 14 }}
        onClick={() => setP((x) => ({ ...x, days: [...x.days, { name: `Séance ${String.fromCharCode(65 + x.days.length)}`, exercises: [] }] }))}
      >
        <Icon name="plus" size={18} /> Ajouter une séance
      </button>

      {activeProgramId !== p.id && (
        <label className="small" style={{ marginTop: 12, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} style={{ width: 20, height: 20, minHeight: 0, flexShrink: 0 }} />
          <span>Activer ce programme (onglet Séance)</span>
        </label>
      )}
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
      {onDelete && (
        <button
          className="btn block danger"
          style={{ marginTop: 20 }}
          onClick={() => {
            onClose();
            onDelete();
          }}
        >
          <Icon name="trash" size={18} /> Supprimer ce programme
        </button>
      )}
    </Sheet>
  );
}
