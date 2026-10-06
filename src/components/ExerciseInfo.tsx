import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getExercise, MUSCLE_LABELS } from '../data/exercises';
import { guideFor, PATTERN_LABELS, PATTERN_STEPS } from '../data/exerciseGuide';
import ExerciseFigure from './ExerciseFigure';
import MuscleMap from './MuscleMap';
import { Icon } from './ui';

const Ctx = createContext<(id: string) => void>(() => {});

/** Fournit l'ouverture de la fiche d'exercice partout dans l'app. */
export function ExerciseInfoProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string>();
  const open = useCallback((x: string) => setId(x), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {id && <ExerciseSheet id={id} onClose={() => setId(undefined)} />}
    </Ctx.Provider>
  );
}

/** Nom d'exercice cliquable qui ouvre sa fiche (schéma, muscles, consignes). */
export function ExerciseLink({ id, children }: { id: string; children?: ReactNode }) {
  const open = useContext(Ctx);
  return (
    <button type="button" className="ex-link" onClick={() => open(id)} aria-haspopup="dialog">
      {children ?? getExercise(id).name}
      <Icon name="info" size={14} />
    </button>
  );
}

/** Bouton « i » seul, à côté d'une liste de choix d'exercice. */
export function ExerciseInfoButton({ id }: { id: string }) {
  const open = useContext(Ctx);
  return (
    <button type="button" className="btn" onClick={() => open(id)} aria-haspopup="dialog" aria-label={`Fiche : ${getExercise(id).name}`}>
      <Icon name="info" size={18} />
    </button>
  );
}

function ExerciseSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const ex = getExercise(id);
  const guide = guideFor(id);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    // Capture : si la fiche s'ouvre par-dessus un autre panneau, Échap ne ferme qu'elle.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop over" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <div className="sheet-kicker">{PATTERN_LABELS[guide.pattern]}</div>
            <h2 id="sheet-title">{ex.name}</h2>
          </div>
          <button ref={closeRef} className="btn ghost sm" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={20} />
          </button>
        </div>

        <ExerciseFigure pattern={guide.pattern} />

        <div className="sheet-grid">
          <div>
            <h3>Muscles travaillés</h3>
            <MuscleMap primary={ex.primary} secondary={ex.secondary} />
            <div className="row" style={{ marginTop: 6 }}>
              {ex.primary.map((m) => (
                <span key={m} className="tag mm-tag-primary">
                  {MUSCLE_LABELS[m]}
                </span>
              ))}
              {ex.secondary.map((m) => (
                <span key={m} className="tag">
                  {MUSCLE_LABELS[m]}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3>Matériel</h3>
            <p className="secondary">{guide.gear}</p>
            <h3>Exécution</h3>
            <ol className="sheet-steps">
              {PATTERN_STEPS[guide.pattern].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {(guide.cue || ex.tips) && (
              <div className="hint">
                {guide.cue && <div>👉 {guide.cue}</div>}
                {ex.tips && <div>💡 {ex.tips}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
