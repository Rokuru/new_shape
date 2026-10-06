import { useEffect, useMemo, useState } from 'react';
import { MUSCLE_LABELS } from '../data/exercises';
import { EQUIPMENT_LABELS, SplitPicker } from '../components/ProfileForm';
import { canDo, programScore, programStats, STYLE_LABELS } from '../lib/programStats';
import type { Tab } from '../App';
import { MUSCLES } from '../data/exercises';
import { PROGRAMS } from '../data/programs';
import { GOAL_LABELS, volumeFromSets } from '../lib/calc';
import { generateProgram, weeklySetTarget } from '../lib/generator';
import { uid, useStore } from '../lib/store';
import type { PlannedExercise, Profile, Program, ProgramStyle } from '../lib/types';
import { LEVEL_LABELS } from '../components/ProfileForm';
import { fmtNum, Icon } from '../components/ui';
import VolumeBars from '../components/VolumeBars';
import { ExerciseLink } from '../components/ExerciseInfo';
import Sheet from '../components/Sheet';
import ProgramEditor, { blankProgram, toEditable } from '../components/ProgramEditor';
import { safeUrl } from '../lib/sanitize';
import { EXERCISES, getExercise } from '../data/exercises';
import { getStretch, suggestStretches } from '../data/stretches';

/** Programme issu du générateur et jamais modifié à la main (drapeau, ou auteur pour les versions précédentes). */
const isGenerated = (p: Program) => p.generated ?? p.author === 'Généré à partir de ton profil';

export default function ProgramsPage({ go }: { go: (t: Tab) => void }) {
  const { profile, setProfile, customPrograms, activeProgramId, activateProgram, saveCustomProgram, deleteCustomProgram } = useStore();
  const [seed, setSeed] = useState(0);
  const [editing, setEditing] = useState<{ program: Program; isNew: boolean }>();
  const generated = useMemo(() => generateProgram(profile), [profile, seed]);
  // Exercices remplacés à la main dans le programme proposé (effacés quand le profil change).
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  useEffect(() => setSwaps({}), [generated]);
  const shown = useMemo(() => applySwaps(generated, swaps), [generated, swaps]);
  const [swapping, setSwapping] = useState<{ d: number; j: number }>();
  const previous = customPrograms.find(isGenerated);
  const [keepOld, setKeepOld] = useState(false);

  // Suppression annulable pendant quelques secondes.
  const [undo, setUndo] = useState<{ program: Program; wasActive: boolean; nextDayIndex: number }>();
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(undefined), 8000);
    return () => clearTimeout(t);
  }, [undo]);
  const remove = (p: Program) => {
    const st = useStore.getState();
    setUndo({ program: p, wasActive: st.activeProgramId === p.id, nextDayIndex: st.nextDayIndex });
    deleteCustomProgram(p.id);
  };
  const restore = () => {
    if (!undo) return;
    // Nouvel identifiant : la suppression a pu déjà partir vers les autres appareils.
    const copy = { ...undo.program, id: uid() };
    saveCustomProgram(copy);
    if (undo.wasActive) useStore.setState({ activeProgramId: copy.id, nextDayIndex: undo.nextDayIndex });
    setUndo(undefined);
  };

  const [style, setStyle] = useState<ProgramStyle | 'all'>('all');
  const score = (p: Program) => programScore(p, profile);
  const library = [...PROGRAMS].filter((p) => style === 'all' || p.style === style).sort((a, b) => score(b) - score(a));

  return (
    <div>
      <h1>Programmes</h1>

      <div className="card">
        <div className="card-header">
          <h2>Programme sur mesure</h2>
          <button className="btn ghost sm" onClick={() => go('profile')}>
            Modifier mon profil
          </button>
        </div>
        <p className="small secondary">
          Généré à partir de ton profil ({GOAL_LABELS[profile.goal].toLowerCase()}, {LEVEL_LABELS[profile.level].toLowerCase()}, {profile.daysPerWeek} séances de{' '}
          {profile.sessionMinutes} min). Il applique les principes qui font consensus : 10–20 séries dures par muscle et par semaine, séries à 0–3 répétitions de l’échec,
          surcharge progressive, et chaque muscle 2×/semaine quand la répartition le permet.
        </p>
        <div className="pe-stretch" style={{ marginBottom: 12 }}>
          <SplitPicker profile={profile} onChange={setProfile} />
        </div>
        <ProgramDetail program={shown} open onSwap={(d, j) => setSwapping({ d, j })} />
        <h3 style={{ marginTop: 16 }}>Volume hebdomadaire prévu</h3>
        <VolumeBars volume={volumeFromSets(shown.days.flatMap((d) => d.exercises))} targets={Object.fromEntries(MUSCLES.map((m) => [m, weeklySetTarget(profile, m)]))} />
        {previous && (
          <label className="small" style={{ marginTop: 12, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={keepOld} onChange={(e) => setKeepOld(e.target.checked)} style={{ width: 20, height: 20, minHeight: 0, flexShrink: 0 }} />
            <span>Garder aussi « {previous.name} » (sinon il est remplacé)</span>
          </label>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={() => {
              const p = previous && !keepOld ? { ...shown, id: previous.id } : shown;
              saveCustomProgram(p);
              activateProgram(p.id);
              setSeed((s) => s + 1);
              setKeepOld(false);
            }}
          >
            {previous && !keepOld ? 'Remplacer mon programme généré et l’activer' : 'Enregistrer et activer'}
          </button>
        </div>
      </div>
      {swapping && (
        <SwapSheet
          profile={profile}
          planned={shown.days[swapping.d].exercises[swapping.j]}
          exclude={shown.days[swapping.d].exercises.map((e) => e.exerciseId)}
          onClose={() => setSwapping(undefined)}
          onPick={(id) => {
            setSwaps((x) => ({ ...x, [`${swapping.d}:${swapping.j}`]: id }));
            setSwapping(undefined);
          }}
        />
      )}

      <div className="spread" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Mes programmes</h2>
        <button className="btn sm primary" onClick={() => setEditing({ program: blankProgram(profile.level, profile.goal), isNew: true })}>
          <Icon name="plus" size={16} /> Créer un programme
        </button>
      </div>
      {customPrograms.length === 0 && (
        <p className="small secondary">
          Crée ta séance perso de zéro, ou touche « Personnaliser » sur un programme de la bibliothèque pour en faire une copie modifiable (exercices, séries, répétitions,
          repos, étirements).
        </p>
      )}
      {customPrograms.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          active={p.id === activeProgramId}
          onActivate={() => activateProgram(p.id)}
          onEdit={() => setEditing({ program: toEditable(p, false), isNew: false })}
          onDelete={() => remove(p)}
        />
      ))}

      <h2>Bibliothèque</h2>
      <p className="small secondary">
        {PROGRAMS.length} programmes inspirés de coachs et de chercheurs reconnus, chacun avec ses sources et ce qu’en disent les études. Triés selon ton profil (niveau, matériel,
        objectif, nombre et durée des séances).
      </p>
      <div className="chips" style={{ marginBottom: 12 }}>
        {(['all', ...Object.keys(STYLE_LABELS)] as (ProgramStyle | 'all')[]).map((s) => (
          <button key={s} type="button" className={`chip ${style === s ? 'on' : ''}`} aria-pressed={style === s} onClick={() => setStyle(s)}>
            {s === 'all' ? 'Tous' : STYLE_LABELS[s]} ({s === 'all' ? PROGRAMS.length : PROGRAMS.filter((p) => p.style === s).length})
          </button>
        ))}
      </div>
      <CompareTable programs={library} />
      {library.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          active={p.id === activeProgramId}
          recommended={score(p) >= 5}
          missingEquipment={!canDo(p, profile.equipment)}
          onActivate={() => activateProgram(p.id)}
          onCopy={() => setEditing({ program: toEditable(p, true), isNew: true })}
        />
      ))}
      {editing && (
        <ProgramEditor
          key={editing.program.id}
          initial={editing.program}
          isNew={editing.isNew}
          onClose={() => setEditing(undefined)}
          onDelete={editing.isNew ? undefined : () => remove(editing.program)}
        />
      )}
      {undo && (
        <div className="snackbar" role="status">
          <span>« {undo.program.name} » supprimé</span>
          <button className="btn sm" onClick={restore}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

/** Comparaison chiffrée, calculée à partir des séances de chaque programme. */
function CompareTable({ programs }: { programs: Program[] }) {
  return (
    <details className="card">
      <summary>
        <b>Comparer les programmes</b> <span className="small muted" style={{ fontWeight: 400 }}>volume, fréquence, intensité, durée</span>
      </summary>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Programme</th>
              <th className="num">Séances</th>
              <th className="num">Séries dures / sem.</th>
              <th className="num">Fréquence / muscle</th>
              <th className="num">Séries lourdes</th>
              <th className="num">Durée</th>
              <th>Sous le minimum</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => {
              const st = programStats(p);
              return (
                <tr key={p.id}>
                  <td style={{ minWidth: 160 }}>
                    <a href={`#prog-${p.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`prog-${p.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
                      {p.name}
                    </a>
                  </td>
                  <td className="num">{p.daysPerWeek}</td>
                  <td className="num">{st.hardSets}</td>
                  <td className="num">{fmtNum(st.frequency)}×</td>
                  <td className="num">{Math.round(st.heavyShare * 100)} %</td>
                  <td className="num">{st.minutes} min</td>
                  <td className="small" style={{ minWidth: 150 }}>{st.belowMev.length ? st.belowMev.map((m) => MUSCLE_LABELS[m]).join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Séries dures : séries finies à 3 répétitions de l’échec ou moins (échauffement, vitesse et récupération exclus). Fréquence : nombre de séances par semaine où chaque grand groupe
        travaille. Séries lourdes : ≤ 6 répétitions. Repères des méta-analyses pour l’hypertrophie : au moins 10 séries par muscle et par semaine, chaque muscle 2× par semaine, sans
        obligation d’aller à l’échec. « Sous le minimum » : muscles sous le volume minimum efficace (MEV, Renaissance Periodization).
      </p>
    </details>
  );
}

function ProgramCard({
  program,
  active,
  recommended,
  missingEquipment,
  onActivate,
  onDelete,
  onEdit,
  onCopy,
}: {
  program: Program;
  active: boolean;
  recommended?: boolean;
  missingEquipment?: boolean;
  onActivate: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
}) {
  const st = programStats(program);
  return (
    <div className="card" id={`prog-${program.id}`} style={active ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ marginBottom: 2 }}>{program.name}</h3>
          <div className="small muted">{program.author}</div>
        </div>
        <div className="row" style={{ flexShrink: 0 }}>
          {active ? (
            <span className="status ok">
              <Icon name="check" size={14} /> Actif
            </span>
          ) : (
            <button className="btn sm primary" onClick={onActivate}>
              Activer
            </button>
          )}
          {onEdit && (
            <button className="btn sm" onClick={onEdit}>
              <Icon name="edit" size={16} /> Modifier
            </button>
          )}
          {onCopy && (
            <button className="btn sm" onClick={onCopy}>
              <Icon name="copy" size={16} /> Personnaliser
            </button>
          )}
          {onDelete && (
            <button className="btn sm danger" onClick={onDelete}>
              <Icon name="trash" size={16} /> Supprimer
            </button>
          )}
        </div>
      </div>
      <div className="row" style={{ margin: '8px 0' }}>
        {recommended && <span className="tag" style={{ background: 'var(--band)', color: 'var(--accent)' }}>Recommandé pour toi</span>}
        {program.style && <span className="tag">Méthode : {STYLE_LABELS[program.style].toLowerCase()}</span>}
        <span className="tag">{program.daysPerWeek} j / sem.</span>
        {missingEquipment && (
          <span className="tag" style={{ color: 'var(--critical)' }}>
            Matériel : {st.equipment.map((e) => EQUIPMENT_LABELS[e].split(' :')[0].split(' (')[0]).join(' ou ')}
          </span>
        )}
        {program.level.map((l) => (
          <span className="tag" key={l}>
            {LEVEL_LABELS[l].split(' (')[0]}
          </span>
        ))}
        {program.goals.map((g) => (
          <span className="tag" key={g}>
            {GOAL_LABELS[g]}
          </span>
        ))}
      </div>
      <p className="small secondary">{program.description}</p>
      <p className="small muted" style={{ margin: '0 0 6px' }}>
        {st.hardSets} séries dures / sem. · chaque muscle {fmtNum(st.frequency)}× / sem. · ~{st.minutes} min par séance
      </p>
      <ProgramDetail program={program} />
      {(program.evidence || program.sources?.length) && (
        <details>
          <summary className="small">Ce qu’en disent les études · sources</summary>
          {program.evidence && <p className="small secondary" style={{ marginTop: 8 }}>{program.evidence}</p>}
          {program.sources && (
            <ul className="small" style={{ paddingLeft: 18, margin: '6px 0 0' }}>
              {program.sources.map((s) =>
                safeUrl(s.url) ? (
                  <li key={s.url}>
                    <a href={safeUrl(s.url)} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </details>
      )}
    </div>
  );
}

function ProgramDetail({ program, open, onSwap }: { program: Program; open?: boolean; onSwap?: (day: number, index: number) => void }) {
  return (
    <details open={open}>
      <summary className="small">Détail des séances</summary>
      <div className="grid grid-2" style={{ marginTop: 8 }}>
        {program.days.map((d, i) => (
          <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 10, minWidth: 0 }}>
            <b className="small">{d.name}</b>
            <table>
              <tbody>
                {d.exercises.map((e, j) => (
                  <tr key={j}>
                    <td>
                      <ExerciseLink id={e.exerciseId} />
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}
                    </td>
                    {onSwap && (
                      <td style={{ width: 1, padding: 0 }}>
                        <button className="btn ghost sm" aria-label={`Remplacer ${getExercise(e.exerciseId).name}`} title="Remplacer cet exercice" onClick={() => onSwap(i, j)}>
                          <Icon name="swap" size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <StretchLine day={d} />
          </div>
        ))}
      </div>
      <p className="small secondary" style={{ marginTop: 8 }}>
        <b>Progression :</b> {program.progression}
      </p>
    </details>
  );
}


function StretchLine({ day }: { day: Program['days'][number] }) {
  const ids = day.stretches ?? suggestStretches(day.exercises, getExercise);
  if (!ids.length) return null;
  return (
    <div className="small muted" style={{ marginTop: 6 }}>
      🧘 Étirements{day.stretches ? '' : ' conseillés'} : {ids.map((id) => getStretch(id)?.name ?? id).join(', ')}
    </div>
  );
}

/** Pas des exercices de musculation : jamais proposés en remplacement. */
const NOT_STRENGTH = new Set(['jumping_jacks', 'high_knees']);

/** Remplace des exercices du programme proposé ; les répétitions suivent le type du nouvel exercice. */
function applySwaps(p: Program, swaps: Record<string, string>): Program {
  if (!Object.keys(swaps).length) return p;
  return {
    ...p,
    days: p.days.map((d, i) => ({
      ...d,
      exercises: d.exercises.map((e, j) => {
        const id = swaps[`${i}:${j}`];
        if (!id) return e;
        const same = getExercise(id).kind === getExercise(e.exerciseId).kind;
        const reps: Partial<PlannedExercise> = same ? {} : getExercise(id).kind === 'compound' ? { repMin: 8, repMax: 12, restSec: 120 } : { repMin: 10, repMax: 15, restSec: 75 };
        return { ...e, ...reps, exerciseId: id };
      }),
    })),
  };
}

function SwapSheet({ profile, planned, exclude, onPick, onClose }: { profile: Profile; planned: PlannedExercise; exclude: string[]; onPick: (id: string) => void; onClose: () => void }) {
  const cur = getExercise(planned.exerciseId);
  const machines = profile.preferMachines && profile.equipment === 'full_gym';
  const options = EXERCISES.filter((e) => e.primary[0] === cur.primary[0] && e.equipment.includes(profile.equipment) && !exclude.includes(e.id) && !NOT_STRENGTH.has(e.id)).sort(
    (a, b) =>
      Number(b.kind === cur.kind) - Number(a.kind === cur.kind) ||
      (machines ? Number(!!b.machine) - Number(!!a.machine) : 0) ||
      a.name.localeCompare(b.name, 'fr'),
  );
  return (
    <Sheet title={cur.name} kicker="Remplacer l’exercice" onClose={onClose}>
      <p className="small secondary" style={{ marginTop: 0 }}>
        Exercices qui travaillent surtout les {MUSCLE_LABELS[cur.primary[0]].toLowerCase()}, faisables avec ton matériel ({EQUIPMENT_LABELS[profile.equipment].toLowerCase()}). Touche un nom pour
        voir sa fiche.
      </p>
      {options.length ? (
        <ul className="swap-list">
          {options.map((e) => (
            <li key={e.id}>
              <div>
                <ExerciseLink id={e.id} />
                <div className="small muted">
                  {e.kind === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                  {e.machine ? ' · machine' : ''}
                </div>
              </div>
              <button className="btn sm primary" onClick={() => onPick(e.id)}>
                Choisir
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Aucun autre exercice disponible avec ton matériel.</p>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        Le remplacement s’applique au programme proposé ; il est gardé quand tu l’enregistres. Pour un programme déjà enregistré, utilise « Modifier ».
      </p>
    </Sheet>
  );
}
