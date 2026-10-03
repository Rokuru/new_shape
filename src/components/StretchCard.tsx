import { useEffect, useState } from 'react';
import { getStretch, STRETCHES, stretchMinutes } from '../data/stretches';
import { MUSCLE_LABELS } from '../data/exercises';
import { beep, unlockAudio } from '../lib/restAlert';
import MuscleMap from './MuscleMap';
import Sheet from './Sheet';
import { Icon } from './ui';

type Item = { id: string; done: boolean };

/** Fiche d'un étirement : muscles visés, durée, consignes. */
export function StretchSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = getStretch(id);
  if (!s) return null;
  return (
    <Sheet title={s.name} kicker="Étirement" onClose={onClose}>
      <div className="sheet-grid">
        <div>
          <MuscleMap primary={s.muscles.slice(0, 1)} secondary={s.muscles.slice(1)} />
        </div>
        <div>
          <p className="secondary" style={{ marginTop: 0 }}>
            <b>
              {s.holdSec} s{s.sides ? ' de chaque côté' : ''}, 2 fois
            </b>{' '}
            · {s.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
          </p>
          <ol className="sheet-steps">
            {s.steps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="small muted">Étire-toi jusqu’à une tension nette mais sans douleur, en respirant lentement. Pas d’à-coups.</p>
        </div>
      </div>
    </Sheet>
  );
}

/** Partie étirements de la séance en cours : minuteur de maintien, coche, ajout ou retrait. */
export default function StretchCard({ items, onChange }: { items: Item[]; onChange: (items: Item[]) => void }) {
  const [info, setInfo] = useState<string>();
  const [timer, setTimer] = useState<{ id: string; end: number }>();
  const [now, setNow] = useState(Date.now());
  const [adding, setAdding] = useState('');

  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [timer]);
  const left = timer ? Math.ceil((timer.end - now) / 1000) : 0;
  useEffect(() => {
    if (timer && left <= 0) {
      beep();
      navigator.vibrate?.(200);
      setTimer(undefined);
    }
  }, [timer, left]);

  const toggle = (id: string) => onChange(items.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const done = items.filter((x) => x.done).length;

  return (
    <div className="card stretch-card">
      <div className="card-header">
        <h2>Étirements</h2>
        <span className="small muted">
          {done}/{items.length} · ≈ {stretchMinutes(items.map((x) => x.id))} min
        </span>
      </div>
      <p className="small secondary" style={{ marginTop: 0 }}>
        En fin de séance, muscles encore chauds : 2 maintiens de 20 à 30 s par muscle, sans douleur.
      </p>
      {items.map(({ id, done: isDone }) => {
        const s = getStretch(id);
        if (!s) return null;
        const running = timer?.id === id;
        return (
          <div key={id} className={`stretch-row ${isDone ? 'done' : ''}`}>
            <button type="button" className={`pick ${isDone ? 'on' : ''}`} aria-pressed={isDone} aria-label={`${s.name} : fait`} onClick={() => toggle(id)}>
              {isDone ? <Icon name="check" size={12} /> : null}
            </button>
            <button type="button" className="stretch-name" onClick={() => setInfo(id)}>
              <span>{s.name}</span>
              <span className="small muted">
                {s.holdSec} s{s.sides ? ' × 2 côtés' : ''} · {s.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </span>
            </button>
            <button
              type="button"
              className={`btn sm ${running ? 'primary' : ''}`}
              onClick={() => {
                unlockAudio();
                setNow(Date.now());
                setTimer(running ? undefined : { id, end: Date.now() + s.holdSec * 1000 });
              }}
            >
              {running ? `${left} s` : (
                <>
                  <Icon name="play" size={14} /> {s.holdSec} s
                </>
              )}
            </button>
            <button type="button" className="btn ghost sm" aria-label={`Retirer ${s.name}`} onClick={() => onChange(items.filter((x) => x.id !== id))}>
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
      <div className="row" style={{ flexWrap: 'nowrap', marginTop: 8 }}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Ajouter un étirement">
          <option value="">Ajouter un étirement…</option>
          {STRETCHES.filter((s) => !items.some((x) => x.id === s.id)).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={!adding}
          aria-label="Ajouter l’étirement"
          onClick={() => {
            onChange([...items, { id: adding, done: false }]);
            setAdding('');
          }}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
      {info && <StretchSheet id={info} onClose={() => setInfo(undefined)} />}
    </div>
  );
}
