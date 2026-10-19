import { useEffect, useRef, useState } from 'react';
import type { Tab } from '../App';
import { EXERCISES, getExercise, MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { computeBmr, isWorkSet, tonnage } from '../lib/calc';
import { energyBasis, workoutKcal } from '../lib/energy';
import { history, prefillSets, suggest, withWarmup } from '../lib/progression';
import { activeMs, allPrograms, useStore } from '../lib/store';
import { planAdjust, planProgramId, planStatus } from '../lib/plan';
import { useToday } from '../hooks/useToday';
import { dayKey, firstOfMonth } from '../lib/dates';
import type { LoggedExercise, LoggedSet, Workout } from '../lib/types';
import { Empty, fmtDate, fmtNum, Icon } from '../components/ui';
import ActivityCard from '../components/ActivityCard';
import CardioCard from '../components/CardioCard';
import { ExerciseLink } from '../components/ExerciseInfo';
import NumField from '../components/NumField';
import SetNumber from '../components/SetNumber';
import StretchCard from '../components/StretchCard';
import { getStretch, suggestStretches } from '../data/stretches';
import WorkoutEditor, { DuplicateWorkout } from '../components/WorkoutEditor';
import { loadPrefs, loadRestEnd, notifySupported, requestNotify, restDone, savePrefs, saveRestEnd, unlockAudio, type RestAlertPrefs } from '../lib/restAlert';
import { useConfirm } from '../components/ConfirmDialog';

export default function WorkoutPage({ go }: { go: (t: Tab) => void }) {
  const { activeWorkout, customPrograms, activeProgramId, nextDayIndex, startWorkout, workouts, deleteWorkout, profile } = useStore();
  const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);
  const todayKey = useToday();
  const plan = planStatus(profile, todayKey);
  const onPlan = plan && program?.id === planProgramId(plan.tpl, plan.phase) ? plan : undefined;
  const adjust = program ? planAdjust(profile, program.id, todayKey) : undefined;

  const [editId, setEditId] = useState<string>();
  const [dupId, setDupId] = useState<string>();
  if (activeWorkout) return <ActiveWorkout workout={activeWorkout} go={go} />;
  const editing = workouts.find((w) => w.id === editId);
  const duplicating = workouts.find((w) => w.id === dupId);

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
              {onPlan && (
                <p className="small secondary" style={{ marginTop: 0 }}>
                  <a href="#plan" onClick={(e) => (e.preventDefault(), go('plan'))}>
                    Plan objectif
                  </a>{' '}
                  · {onPlan.started ? `semaine ${onPlan.week}/${onPlan.tpl.weeks}` : `départ le ${fmtDate(onPlan.start, { weekday: 'long', day: 'numeric', month: 'long' })}`} · marche inclinée{' '}
                  {onPlan.phase.cardio.walk} · {onPlan.phase.cardio.steps} pas/jour
                  {adjust && (
                    <>
                      <br />
                      <b>{adjust.label.replace(', déjà appliqué', ', appliqué au démarrage').replace(', déjà appliqués', ', appliqués au démarrage')}</b>
                    </>
                  )}
                </p>
              )}
              <div className="stack">
                {program.days.map((d, i) => (
                  <div className="list-item" key={i}>
                    <div style={{ minWidth: 0 }}>
                      <div>
                        {d.name} {i === nextDayIndex % program.days.length && <span className="tag">Prochaine</span>}
                      </div>
                      <div className="small muted">
                        {d.exercises.length} exercices · {d.exercises.reduce((s, e) => s + e.sets, 0)} séries
                      </div>
                      {d.note && <div className="small secondary day-note">👉 {d.note}</div>}
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
          <button className="btn block" style={{ marginBottom: 16 }} onClick={() => startWorkout()}>
            <Icon name="plus" size={18} /> Séance libre
          </button>
          <MySessions workouts={workouts} onEdit={setEditId} onDuplicate={setDupId} onDelete={deleteWorkout} />
        </div>

        <div>
          <ActivityCard />
          <CardioCard />
        </div>
      </div>
      {editing && <WorkoutEditor key={editing.id} workout={editing} onClose={() => setEditId(undefined)} />}
      {duplicating && <DuplicateWorkout workout={duplicating} onClose={() => setDupId(undefined)} onCopied={setEditId} />}
    </div>
  );
}

/** Mes séances : les plus récentes d'abord, détail dépliable (exercices, étirements) et actions. */
function MySessions({
  workouts,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  workouts: Workout[];
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { profile, body } = useStore();
  const ask = useConfirm();
  const [limit, setLimit] = useState(8);
  const basis = energyBasis(body, profile);
  const bmr = computeBmr(profile, basis.weightKg, basis.bodyFatPct).bmr;
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="card">
      <div className="card-header">
        <h2>Mes séances</h2>
        {sorted.length > 0 && (
          <span className="small muted">
            {sorted.length} séance{sorted.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {sorted.length === 0 && <Empty>Aucune séance enregistrée.</Empty>}
      {sorted.slice(0, limit).map((w) => (
        <details key={w.id} className="list-item session-item">
          <summary>
            <span className="session-sum">
              <span className="session-name">{w.dayName}</span>
              <span className="small muted">
                {fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtNum(tonnage(w) / 1000, 1)} t{w.durationMin ? ` · ${w.durationMin} min` : ''} ·{' '}
                {fmtNum(workoutKcal(w, bmr), 0)} kcal
              </span>
            </span>
          </summary>
          <div className="small" style={{ marginTop: 8 }}>
            {w.stretches?.some((s) => s.done) && (
              <div style={{ marginBottom: 4 }}>
                <b>Étirements</b> : {w.stretches.filter((s) => s.done).map((s) => getStretch(s.id)?.name ?? s.id).join(', ')}
              </div>
            )}
            {w.exercises.map((e, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <b>
                  <ExerciseLink id={e.exerciseId} />
                </b>{' '}
                :{' '}
                {setsSummary(e.sets)}
              </div>
            ))}
            {w.note && <div className="muted" style={{ marginBottom: 4 }}>📝 {w.note}</div>}
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn sm" onClick={() => onEdit(w.id)}>
                <Icon name="edit" size={16} /> Modifier
              </button>
              <button className="btn sm" onClick={() => onDuplicate(w.id)}>
                <Icon name="copy" size={16} /> Dupliquer
              </button>
              <button
                className="btn danger ghost sm"
                onClick={async () => {
                  if (await ask({ title: 'Supprimer cette séance ?', message: `${w.dayName} du ${firstOfMonth(fmtDate(dayKey(w.date), { weekday: 'long', day: 'numeric', month: 'long' }))} : séries et notes.` })) onDelete(w.id);
                }}
              >
                <Icon name="trash" size={16} /> Supprimer
              </button>
            </div>
          </div>
        </details>
      ))}
      {sorted.length > limit && (
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setLimit((l) => l + 15)}>
          Afficher plus ({sorted.length - limit} séance{sorted.length - limit > 1 ? 's' : ''} plus ancienne{sorted.length - limit > 1 ? 's' : ''})
        </button>
      )}
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

/** « éch. 80×12 · 160×12, 160×11 » : séries validées, l'échauffement à part. */
function setsSummary(sets: LoggedSet[]): string {
  const fmt = (s: LoggedSet) => `${fmtNum(s.weight)}×${s.reps}`;
  const warm = sets.filter((s) => s.done && s.warmup).map(fmt);
  const work = sets.filter(isWorkSet).map(fmt);
  return [warm.length ? `éch. ${warm.join(', ')}` : '', work.join(', ')].filter(Boolean).join(' · ');
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

/** « 18:42 », ou « le 12 oct. à 18:42 » pour une pause commencée un autre jour. */
function pausedSince(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return dayKey(iso) === dayKey(new Date().toISOString()) ? time : `le ${fmtDate(dayKey(iso), { day: 'numeric', month: 'short' })} à ${time}`;
}

function ActiveWorkout({ workout, go }: { workout: Workout; go: (t: Tab) => void }) {
  const { updateActive, finishWorkout, cancelWorkout, pauseWorkout, resumeWorkout, workouts, customPrograms, profile } = useStore();
  const ask = useConfirm();
  // Consigne de la séance (cardio après, circuit) et ajustement du plan objectif appliqué au démarrage.
  const dayNote = allPrograms(customPrograms)
    .find((p) => p.id === workout.programId)
    ?.days.find((d) => d.name === workout.dayName)?.note;
  const planNote = planAdjust(profile, workout.programId, dayKey(workout.date))?.label;
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
    // Valider une série pendant la pause, c'est qu'on a repris.
    if (done && workout.pausedAt) resumeWorkout();
    setEx(i, (e) => ({
      ...e,
      // Propage la charge validée aux séries de travail suivantes encore vides (jamais celle de l'échauffement).
      sets: e.sets.map((x, j) => (j === k ? { ...x, done } : j > k && !x.done && done && !s.warmup && !x.warmup && x.weight === 0 ? { ...x, weight: s.weight } : x)),
    }));
    // Repos 0 : circuit, on enchaîne sans minuteur. Après l'échauffement : 1 min au plus.
    const rest = s.warmup ? Math.min(60, ex.target?.restSec ?? 60) : (ex.target?.restSec ?? 90);
    if (done && rest > 0) {
      unlockAudio();
      setRestEnd(Date.now() + rest * 1000);
    }
  };

  // Chrono sans les pauses : il s'arrête pendant la pause.
  const elapsed = Math.round(activeMs(workout, now) / 1000);
  const doneSets = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const pausedAt = workout.pausedAt;
  const pause = () => {
    setRestEnd(undefined);
    pauseWorkout();
  };

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{workout.dayName}</h1>
          <div className="workout-meta small muted">
            <span>
              {mmss(elapsed)}
              {pausedAt && ' (en pause)'} · {doneSets}/{totalSets} séries
            </span>
            {!pausedAt && (
              <button className="btn sm" onClick={pause}>
                <Icon name="pause" size={16} /> Pause
              </button>
            )}
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

      {pausedAt && (
        <div className="callout small paused-banner" role="status">
          <div>
            <b>Séance en pause depuis {pausedSince(pausedAt)}.</b>{' '}
            {doneSets === 0
              ? 'Rien n’est encore validé : à la reprise, le chrono repart de zéro et la séance prend l’heure de la reprise.'
              : 'Le chrono est arrêté : le temps de pause ne compte pas dans la durée ni dans les calories de la séance.'}
          </div>
          <button className="btn go" onClick={resumeWorkout}>
            <Icon name="play" size={18} /> Reprendre la séance
          </button>
        </div>
      )}

      {(planNote || dayNote) && (
        <div className="callout small plan-banner">
          {planNote && <div>📉 {planNote}</div>}
          {dayNote && <div>👉 {dayNote}</div>}
        </div>
      )}

      <RestAlertSettings prefs={prefs} onChange={setPrefs} />
      {workout.exercises.some((e) => e.sets.some((s) => s.warmup)) && (
        <p className="small muted warmup-legend">
          <span className="set-num" aria-hidden>
            <span>É</span>
          </span>
          Série d’échauffement : hors progression, records et volume. Touche le numéro d’une série pour la marquer ou non.
        </p>
      )}

      {workout.exercises.map((ex, i) => (
        <ExerciseCard
          key={i}
          ex={ex}
          workouts={workouts}
          currentId={workout.id}
          onSet={(k, p) => setSet(i, k, p)}
          onToggle={(k) => toggleDone(i, k)}
          onAddSet={() =>
            setEx(i, (e) => {
              const base = e.sets.filter((x) => !x.warmup).at(-1) ?? e.sets.at(-1) ?? { weight: 0, reps: 10 };
              return { ...e, sets: [...e.sets, { weight: base.weight, reps: base.reps, done: false }] };
            })
          }
          onDeleteSet={(k) => setEx(i, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== k) }))}
          onRestoreSet={(k, set) => setEx(i, (e) => ({ ...e, sets: [...e.sets.slice(0, k), set, ...e.sets.slice(k)] }))}
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
                // Mêmes séries que la dernière fois, une par une (charges et répétitions de chaque série).
                const past = history(workouts, adding);
                updateActive((w) => ({ ...w, exercises: [...w.exercises, { exerciseId: adding, sets: withWarmup(adding, prefillSets(past), past) }] }));
                setAdding('');
              }}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </label>
      </div>

      <StretchCard
        // Séance libre : étirements suggérés d'après les exercices ajoutés, tant que l'utilisateur n'a rien modifié.
        items={workout.stretches ?? suggestStretches(workout.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.length })), getExercise).map((id) => ({ id, done: false }))}
        onChange={(stretches) => updateActive((w) => ({ ...w, stretches }))}
      />

      <label className="field" style={{ marginBottom: 16 }}>
        Notes (sommeil, énergie, douleurs…)
        <textarea rows={2} value={workout.note ?? ''} onChange={(e) => updateActive((w) => ({ ...w, note: e.target.value }))} />
      </label>

      <button
        className="btn danger ghost block"
        onClick={async () => {
          if (await ask({ title: 'Abandonner la séance ?', message: 'Les séries ne seront pas enregistrées.', confirmLabel: 'Abandonner' })) cancelWorkout();
        }}
      >
        Abandonner la séance
      </button>

      {remaining !== undefined && remaining > 0 && (
        <>
          {/* Place pour le minuteur fixé en bas : la fin de la page (« Abandonner la séance ») reste atteignable. */}
          <div className="timer-space" aria-hidden="true" />
          <div className="timer" role="timer" aria-live="polite">
            Repos {mmss(remaining)}
            <button onClick={() => setRestEnd((r) => (r ?? Date.now()) + 30000)}>+30 s</button>
            <button onClick={() => setRestEnd(undefined)}>Passer</button>
          </div>
        </>
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
  onDeleteSet,
  onRestoreSet,
  onRemove,
}: {
  ex: LoggedExercise;
  workouts: Workout[];
  currentId: string;
  onSet: (k: number, p: Partial<LoggedSet>) => void;
  onToggle: (k: number) => void;
  onAddSet: () => void;
  /** Supprime la série k (n'importe laquelle) ; onRestoreSet la remet à sa place (« Annuler »). */
  onDeleteSet: (k: number) => void;
  onRestoreSet: (k: number, set: LoggedSet) => void;
  onRemove: () => void;
}) {
  const info = getExercise(ex.exerciseId);
  const ask = useConfirm();
  // Mode suppression : une corbeille remplace la coche de chaque série.
  const [deleting, setDeleting] = useState(false);
  const [undo, setUndo] = useState<{ k: number; set: LoggedSet; label: string }>();
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(undefined), 8000);
    return () => clearTimeout(t);
  }, [undo]);
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
              {t.sets} × {t.repMin === t.repMax ? t.repMin : `${t.repMin}–${t.repMax}`}
              {ex.sets.some((s) => s.warmup) ? ' + échauffement' : ''} · RIR {t.rir} ·{' '}
              {t.restSec ? `repos ${t.restSec < 60 ? `${t.restSec} s` : `${fmtNum(t.restSec / 60)} min`}` : 'enchaîner sans repos'}
              {t.note ? ` · ${t.note}` : ''}
            </div>
          )}
        </div>
        <button
          className="btn ghost sm"
          onClick={async () => {
            const done = ex.sets.filter((s) => s.done).length;
            const ok = await ask({
              title: `Retirer ${info.name} de la séance ?`,
              message: done ? `${done} série${done > 1 ? 's' : ''} déjà validée${done > 1 ? 's' : ''} ser${done > 1 ? 'ont' : 'a'} perdue${done > 1 ? 's' : ''}.` : 'Ses séries prévues sont retirées.',
              confirmLabel: 'Retirer',
            });
            if (ok) onRemove();
          }}
          aria-label={`Retirer ${info.name}`}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      {(last || sug || info.tips) && (
        <div className="hint">
          {last && (
            <div>
              Dernière fois ({fmtDate(last.date)}) : {setsSummary(last.ex.sets)}
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
      {ex.sets.map((s, k) => {
        // Numéro parmi les séries de travail ; « É » pour l'échauffement.
        const n = ex.sets.slice(0, k + 1).filter((x) => !x.warmup).length;
        const name = s.warmup ? 'échauffement' : `série ${n}`;
        return (
          <div className={`set-row ${s.done ? 'done' : ''} ${s.warmup ? 'warmup' : ''}`} key={k}>
            <SetNumber set={s} index={n} onToggle={() => onSet(k, { warmup: s.warmup ? undefined : true })} />
            {/* Charge 0–999 kg (2 décimales), répétitions entières 0–999 : jamais de valeur négative ou absurde. */}
            <NumField aria-label={`Charge ${name}`} value={s.weight} max={999} decimals={2} onChange={(weight) => onSet(k, { weight })} />
            <NumField aria-label={`Répétitions ${name}`} value={s.reps} max={999} decimals={0} onChange={(reps) => onSet(k, { reps })} />
            <select aria-label={`RIR ${name}`} value={s.rir ?? ''} onChange={(e) => onSet(k, { rir: e.target.value === '' ? undefined : Number(e.target.value) })}>
              <option value="">–</option>
              {[0, 1, 2, 3, 4].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {deleting ? (
              <button
                className="check delete"
                disabled={ex.sets.length <= 1}
                aria-label={`Supprimer ${s.warmup ? 'l’échauffement' : `la série ${n}`}`}
                onClick={async () => {
                  const load = info.bodyweight ? `PDC${s.weight ? ` + ${fmtNum(s.weight)} kg` : ''}` : `${fmtNum(s.weight)} kg`;
                  const ok = await ask({
                    title: `Supprimer ${s.warmup ? 'l’échauffement' : `la série ${n}`} ?`,
                    message: `${info.name} : ${load} × ${s.reps}${s.done ? ', série déjà validée' : ''}.`,
                  });
                  if (!ok) return;
                  setUndo({ k, set: s, label: s.warmup ? 'Échauffement supprimé' : `Série ${n} supprimée` });
                  onDeleteSet(k);
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            ) : (
              <button
                className={`check ${s.done ? 'on' : ''}`}
                onClick={() => onToggle(k)}
                aria-label={s.done ? `Annuler ${s.warmup ? 'l’échauffement' : 'la série'}` : `Valider ${s.warmup ? 'l’échauffement' : 'la série'}`}
                aria-pressed={s.done}
              >
                <Icon name="check" size={18} />
              </button>
            )}
          </div>
        );
      })}
      {deleting && <p className="small muted" style={{ margin: '0 0 8px' }}>Touche la corbeille de la série à supprimer, même déjà validée.</p>}
      {undo && (
        <p className="small set-undo" role="status">
          {undo.label}
          <button
            className="btn ghost sm"
            onClick={() => {
              onRestoreSet(undo.k, undo.set);
              setUndo(undefined);
            }}
          >
            Annuler
          </button>
        </p>
      )}
      <div className="row">
        <button className="btn sm" onClick={onAddSet}>
          <Icon name="plus" size={14} /> Série
        </button>
        {(ex.sets.length > 1 || deleting) && (
          <button className={`btn sm ${deleting ? 'primary' : 'ghost'}`} onClick={() => setDeleting((v) => !v)} aria-pressed={deleting}>
            {deleting ? (
              'Terminé'
            ) : (
              <>
                <Icon name="trash" size={14} /> Supprimer des séries
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
