import { useEffect, useRef, useState } from 'react';
import type { Tab } from '../App';
import { EXERCISES, getExercise, MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { tonnage } from '../lib/calc';
import { history, suggest } from '../lib/progression';
import { allPrograms, useStore } from '../lib/store';
import type { LoggedExercise, LoggedSet, Workout } from '../lib/types';
import { Empty, fmtDate, fmtNum, Icon } from '../components/ui';
import CardioCard from '../components/CardioCard';
import { ExerciseLink } from '../components/ExerciseInfo';
import NumField from '../components/NumField';
import WorkoutEditor from '../components/WorkoutEditor';
import { loadPrefs, loadRestEnd, notifySupported, requestNotify, restDone, savePrefs, saveRestEnd, unlockAudio, type RestAlertPrefs } from '../lib/restAlert';

export default function WorkoutPage({ go }: { go: (t: Tab) => void }) {
  const { activeWorkout, customPrograms, activeProgramId, nextDayIndex, startWorkout, workouts, deleteWorkout } = useStore();
  const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);

  const [editId, setEditId] = useState<string>();
  if (activeWorkout) return <ActiveWorkout workout={activeWorkout} go={go} />;
  const editing = workouts.find((w) => w.id === editId);

  const recent = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  return (
    <div>
      <h1>Séance</h1>
      <div className="split">
      <div>
      {program ? (
        <div className="card">
          <div className="card-header">
            <h2>{program.name}</h2>
          </div>
          <div className="stack">
            {program.days.map((d, i) => (
              <div className="list-item" key={i}>
                <div style={{ minWidth: 0 }}>
                  <div>
                    {d.name} {i === nextDayIndex % program.days.length && <span className="tag">Prochaine</span>}
                  </div>
                  <div className="small muted">{d.exercises.length} exercices · {d.exercises.reduce((s, e) => s + e.sets, 0)} séries</div>
                </div>
                <button className={`btn ${i === nextDayIndex % program.days.length ? 'go' : ''}`} onClick={() => startWorkout(program, i)}>
                  {i === nextDayIndex % program.days.length && <Icon name="play" size={18} />} Démarrer
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="callout">
          Aucun programme actif. <a href="#programs">Choisis-en un</a> ou démarre une séance libre.
        </div>
      )}
      <button className="btn block" onClick={() => startWorkout()}>
        <Icon name="plus" size={18} /> Séance libre
      </button>
      </div>

      <div>
        <CardioCard />
      </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Historique</h2>
      <div className="card">
        {recent.length === 0 && <Empty>Aucune séance enregistrée.</Empty>}
        {recent.map((w) => (
          <details key={w.id} className="list-item" style={{ display: 'block' }}>
            <summary>
              <span>{w.dayName}</span> <span className="small muted">· {fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="small muted">
                {' '}
                · {fmtNum(tonnage(w) / 1000, 1)} t{w.durationMin ? ` · ${w.durationMin} min` : ''}
              </span>
            </summary>
            <div className="small" style={{ marginTop: 8 }}>
              {w.exercises.map((e, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <b>{getExercise(e.exerciseId).name}</b> :{' '}
                  {e.sets
                    .filter((s) => s.done)
                    .map((s) => `${fmtNum(s.weight)}×${s.reps}`)
                    .join(', ')}
                </div>
              ))}
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button className="btn sm" onClick={() => setEditId(w.id)}>
                  <Icon name="edit" size={16} /> Modifier
                </button>
                <button
                  className="btn danger ghost sm"
                  onClick={() => {
                    if (confirm('Supprimer cette séance ?')) deleteWorkout(w.id);
                  }}
                >
                  <Icon name="trash" size={16} /> Supprimer
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
      {editing && <WorkoutEditor key={editing.id} workout={editing} onClose={() => setEditId(undefined)} />}
    </div>
  );
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

function ActiveWorkout({ workout, go }: { workout: Workout; go: (t: Tab) => void }) {
  const { updateActive, finishWorkout, cancelWorkout, workouts } = useStore();
  const now = useNow();
  // Fin du repos conservée si l'appli est rechargée ou mise en arrière-plan ; un repos déjà fini est ignoré.
  const [restEnd, setRestEndState] = useState<number | undefined>(() => {
    const end = loadRestEnd();
    return end && end > Date.now() ? end : undefined;
  });
  const setRestEnd = (v: number | undefined | ((r: number | undefined) => number | undefined)) =>
    setRestEndState((r) => {
      const next = typeof v === 'function' ? v(r) : v;
      saveRestEnd(next);
      return next;
    });
  const [prefs, setPrefsState] = useState<RestAlertPrefs>(loadPrefs);
  const setPrefs = (p: RestAlertPrefs) => {
    setPrefsState(p);
    savePrefs(p);
  };
  const [adding, setAdding] = useState('');

  // Prochaine série à faire, pour le texte de la notification.
  const nextSet = (() => {
    for (const e of workout.exercises) {
      const s = e.sets.find((x) => !x.done);
      if (s) return `${getExercise(e.exerciseId).name}${s.weight ? ` · ${fmtNum(s.weight)} kg` : ''} × ${s.reps}`;
    }
    return undefined;
  })();

  const remaining = restEnd ? Math.round((restEnd - now) / 1000) : undefined;
  // Minuteur dédié : plus précis que le rafraîchissement à la seconde, et il tourne encore onglet masqué (Android, ordinateur).
  // Réglages et prochaine série lus au moment de l'alerte (ils peuvent changer pendant le repos).
  const alertRef = useRef({ prefs, nextSet });
  alertRef.current = { prefs, nextSet };
  useEffect(() => {
    if (!restEnd) return;
    const t = setTimeout(() => {
      void restDone(alertRef.current.prefs, alertRef.current.nextSet);
      setRestEndState(undefined);
      saveRestEnd(undefined);
    }, Math.max(0, restEnd - Date.now()));
    return () => clearTimeout(t);
  }, [restEnd]);

  const setEx = (i: number, fn: (e: LoggedExercise) => LoggedExercise) =>
    updateActive((w) => ({ ...w, exercises: w.exercises.map((e, j) => (j === i ? fn(e) : e)) }));

  const setSet = (i: number, k: number, patch: Partial<LoggedSet>) => setEx(i, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) }));

  const toggleDone = (i: number, k: number) => {
    const ex = workout.exercises[i];
    const s = ex.sets[k];
    const done = !s.done;
    setEx(i, (e) => ({
      ...e,
      // Propage la charge validée aux séries suivantes encore vides.
      sets: e.sets.map((x, j) => (j === k ? { ...x, done } : j > k && !x.done && done && x.weight === 0 ? { ...x, weight: s.weight } : x)),
    }));
    if (done) {
      unlockAudio();
      setRestEnd(Date.now() + (ex.target?.restSec ?? 90) * 1000);
    }
  };

  const elapsed = Math.round((now - new Date(workout.date).getTime()) / 1000);
  const doneSets = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{workout.dayName}</h1>
          <div className="small muted">
            {mmss(elapsed)} · {doneSets}/{totalSets} séries
          </div>
        </div>
        <button
          className="btn primary"
          disabled={doneSets === 0}
          onClick={() => {
            finishWorkout();
            go('progress');
          }}
        >
          <Icon name="check" size={18} /> Terminer
        </button>
      </div>

      <RestAlertSettings prefs={prefs} onChange={setPrefs} />

      {workout.exercises.map((ex, i) => (
        <ExerciseCard
          key={i}
          ex={ex}
          workouts={workouts}
          currentId={workout.id}
          onSet={(k, p) => setSet(i, k, p)}
          onToggle={(k) => toggleDone(i, k)}
          onAddSet={() => setEx(i, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { weight: 0, reps: 10 }), done: false, rir: undefined }] }))}
          onRemoveSet={() => setEx(i, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
          onRemove={() => updateActive((w) => ({ ...w, exercises: w.exercises.filter((_, j) => j !== i) }))}
        />
      ))}

      <div className="card">
        <label className="field">
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
              onClick={() => {
                const past = history(workouts, adding)[0]?.ex.sets.filter((s) => s.done);
                const top = past?.length ? past[0] : { weight: 0, reps: 10 };
                updateActive((w) => ({
                  ...w,
                  exercises: [...w.exercises, { exerciseId: adding, sets: Array.from({ length: 3 }, () => ({ weight: top.weight, reps: top.reps, done: false })) }],
                }));
                setAdding('');
              }}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </label>
      </div>

      <label className="field" style={{ marginBottom: 16 }}>
        Notes (sommeil, énergie, douleurs…)
        <textarea rows={2} value={workout.note ?? ''} onChange={(e) => updateActive((w) => ({ ...w, note: e.target.value }))} />
      </label>

      <button
        className="btn danger ghost block"
        onClick={() => {
          if (confirm('Abandonner cette séance ? Les séries ne seront pas enregistrées.')) cancelWorkout();
        }}
      >
        Abandonner la séance
      </button>

      {remaining !== undefined && remaining > 0 && (
        <div className="timer" role="timer" aria-live="polite">
          Repos {mmss(remaining)}
          <button onClick={() => setRestEnd((r) => (r ?? Date.now()) + 30000)}>+30 s</button>
          <button onClick={() => setRestEnd(undefined)}>Passer</button>
        </div>
      )}
    </div>
  );
}

function RestAlertSettings({ prefs, onChange }: { prefs: RestAlertPrefs; onChange: (p: RestAlertPrefs) => void }) {
  // Affiché seulement après un refus réel : Notification.permission n'est pas fiable partout (navigateurs headless, PWA).
  const [denied, setDenied] = useState(false);
  const supported = notifySupported();
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return (
    <div className="rest-alert">
      <span className="small secondary">Fin de repos :</span>
      <button
        type="button"
        className={`chip ${prefs.sound ? 'on' : ''}`}
        aria-pressed={prefs.sound}
        onClick={() => {
          unlockAudio();
          onChange({ ...prefs, sound: !prefs.sound });
        }}
      >
        🔔 Son
      </button>
      {supported && (
        <button
          type="button"
          className={`chip ${prefs.notify && !denied ? 'on' : ''}`}
          aria-pressed={prefs.notify && !denied}
          onClick={async () => {
            if (prefs.notify) return onChange({ ...prefs, notify: false });
            const ok = await requestNotify();
            setDenied(!ok);
            onChange({ ...prefs, notify: ok });
          }}
        >
          📲 Notification
        </button>
      )}
      {denied && <span className="small muted">Notifications bloquées : autorise-les dans les réglages du navigateur.</span>}
      {!supported && ios && <span className="small muted">Pour les notifications sur iPhone : Partager → « Sur l’écran d’accueil », puis ouvre l’appli depuis l’icône.</span>}
    </div>
  );
}

function ExerciseCard({
  ex,
  workouts,
  currentId,
  onSet,
  onToggle,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  ex: LoggedExercise;
  workouts: Workout[];
  currentId: string;
  onSet: (k: number, p: Partial<LoggedSet>) => void;
  onToggle: (k: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onRemove: () => void;
}) {
  const info = getExercise(ex.exerciseId);
  const past = history(workouts, ex.exerciseId, currentId);
  const last = past[0];
  const sug = ex.target ? suggest(ex.target, past) : undefined;
  const t = ex.target;

  return (
    <div className="card">
      <div className="spread">
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>
            <ExerciseLink id={ex.exerciseId} />
          </h3>
          {t && (
            <div className="small secondary">
              {t.sets} × {t.repMin === t.repMax ? t.repMin : `${t.repMin}–${t.repMax}`} · RIR {t.rir} · repos {Math.round(t.restSec / 60 * 10) / 10} min
              {t.note ? ` · ${t.note}` : ''}
            </div>
          )}
        </div>
        <button className="btn ghost sm" onClick={onRemove} aria-label={`Retirer ${info.name}`}>
          <Icon name="x" size={16} />
        </button>
      </div>
      {(last || sug || info.tips) && (
        <div className="hint">
          {last && (
            <div>
              Dernière fois ({fmtDate(last.date)}) :{' '}
              {last.ex.sets
                .filter((s) => s.done)
                .map((s) => `${fmtNum(s.weight)}×${s.reps}`)
                .join(', ')}
            </div>
          )}
          {sug && (
            <div>
              🎯 <b>
                {fmtNum(sug.weight)} kg × {sug.reps}
              </b>{' '}
              – {sug.reason}
            </div>
          )}
          {!last && info.tips && <div>💡 {info.tips}</div>}
        </div>
      )}
      <div className="set-row head">
        <span>#</span>
        <span>kg</span>
        <span>reps</span>
        <span>RIR</span>
        <span />
      </div>
      {ex.sets.map((s, k) => (
        <div className={`set-row ${s.done ? 'done' : ''}`} key={k}>
          <span className="muted small">{k + 1}</span>
          {/* Charge 0–999 kg (2 décimales), répétitions entières 0–999 : jamais de valeur négative ou absurde. */}
          <NumField aria-label={`Charge série ${k + 1}`} value={s.weight} max={999} decimals={2} onChange={(weight) => onSet(k, { weight })} />
          <NumField aria-label={`Répétitions série ${k + 1}`} value={s.reps} max={999} decimals={0} onChange={(reps) => onSet(k, { reps })} />
          <select aria-label={`RIR série ${k + 1}`} value={s.rir ?? ''} onChange={(e) => onSet(k, { rir: e.target.value === '' ? undefined : Number(e.target.value) })}>
            <option value="">–</option>
            {[0, 1, 2, 3, 4].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className={`check ${s.done ? 'on' : ''}`} onClick={() => onToggle(k)} aria-label={s.done ? 'Annuler la série' : 'Valider la série'} aria-pressed={s.done}>
            <Icon name="check" size={18} />
          </button>
        </div>
      ))}
      <div className="row">
        <button className="btn sm" onClick={onAddSet}>
          <Icon name="plus" size={14} /> Série
        </button>
        {ex.sets.length > 1 && (
          <button className="btn sm ghost" onClick={onRemoveSet}>
            Retirer une série
          </button>
        )}
      </div>
    </div>
  );
}
