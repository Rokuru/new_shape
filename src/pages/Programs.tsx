import { useMemo, useState } from 'react';
import type { Tab } from '../App';
import { getExercise, MUSCLES } from '../data/exercises';
import { PROGRAMS } from '../data/programs';
import { GOAL_LABELS, volumeFromSets } from '../lib/calc';
import { generateProgram, weeklySetTarget } from '../lib/generator';
import { useStore } from '../lib/store';
import type { Program } from '../lib/types';
import { LEVEL_LABELS } from '../components/ProfileForm';
import { Icon } from '../components/ui';
import VolumeBars from '../components/VolumeBars';

export default function ProgramsPage({ go }: { go: (t: Tab) => void }) {
  const { profile, customPrograms, activeProgramId, activateProgram, saveCustomProgram, deleteCustomProgram } = useStore();
  const [seed, setSeed] = useState(0);
  const generated = useMemo(() => generateProgram(profile), [profile, seed]);

  const score = (p: Program) => (p.level.includes(profile.level) ? 2 : 0) + (p.goals.includes(profile.goal) ? 1 : 0) + (p.daysPerWeek === profile.daysPerWeek ? 1 : 0);
  const library = [...PROGRAMS].sort((a, b) => score(b) - score(a));

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
          {profile.sessionMinutes} min). Il applique les principes qui font consensus : chaque muscle 2×/semaine, 10–20 séries dures par muscle et par semaine, séries à
          0–3 répétitions de l’échec, et surcharge progressive.
        </p>
        <ProgramDetail program={generated} open />
        <h3 style={{ marginTop: 16 }}>Volume hebdomadaire prévu</h3>
        <VolumeBars volume={volumeFromSets(generated.days.flatMap((d) => d.exercises))} targets={Object.fromEntries(MUSCLES.map((m) => [m, weeklySetTarget(profile, m)]))} />
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={() => {
              saveCustomProgram(generated);
              activateProgram(generated.id);
              setSeed((s) => s + 1);
            }}
          >
            Enregistrer et activer
          </button>
        </div>
      </div>

      {customPrograms.length > 0 && (
        <>
          <h2>Mes programmes</h2>
          {customPrograms.map((p) => (
            <ProgramCard key={p.id} program={p} active={p.id === activeProgramId} onActivate={() => activateProgram(p.id)} onDelete={() => confirm('Supprimer ce programme ?') && deleteCustomProgram(p.id)} />
          ))}
        </>
      )}

      <h2>Bibliothèque</h2>
      <p className="small secondary">Programmes inspirés de coachs et méthodes reconnus, triés selon leur adéquation à ton profil.</p>
      {library.map((p) => (
        <ProgramCard key={p.id} program={p} active={p.id === activeProgramId} recommended={score(p) >= 3} onActivate={() => activateProgram(p.id)} />
      ))}
    </div>
  );
}

function ProgramCard({ program, active, recommended, onActivate, onDelete }: { program: Program; active: boolean; recommended?: boolean; onActivate: () => void; onDelete?: () => void }) {
  return (
    <div className="card" style={active ? { borderColor: 'var(--accent)' } : undefined}>
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
          {onDelete && (
            <button className="btn sm ghost danger" onClick={onDelete} aria-label="Supprimer">
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="row" style={{ margin: '8px 0' }}>
        {recommended && <span className="tag" style={{ background: 'var(--band)', color: 'var(--accent)' }}>Recommandé pour toi</span>}
        <span className="tag">{program.daysPerWeek} j / sem.</span>
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
      <ProgramDetail program={program} />
    </div>
  );
}

function ProgramDetail({ program, open }: { program: Program; open?: boolean }) {
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
                    <td>{getExercise(e.exerciseId).name}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="small secondary" style={{ marginTop: 8 }}>
        <b>Progression :</b> {program.progression}
      </p>
    </details>
  );
}

