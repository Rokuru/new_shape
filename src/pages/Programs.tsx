import { useMemo, useState } from 'react';
import { MUSCLE_LABELS } from '../data/exercises';
import { EQUIPMENT_LABELS } from '../components/ProfileForm';
import { canDo, programScore, programStats, STYLE_LABELS } from '../lib/programStats';
import type { Tab } from '../App';
import { MUSCLES } from '../data/exercises';
import { PROGRAMS } from '../data/programs';
import { GOAL_LABELS, volumeFromSets } from '../lib/calc';
import { generateProgram, weeklySetTarget } from '../lib/generator';
import { useStore } from '../lib/store';
import type { Program, ProgramStyle } from '../lib/types';
import { LEVEL_LABELS } from '../components/ProfileForm';
import { fmtNum, Icon } from '../components/ui';
import VolumeBars from '../components/VolumeBars';
import { ExerciseLink } from '../components/ExerciseInfo';

export default function ProgramsPage({ go }: { go: (t: Tab) => void }) {
  const { profile, customPrograms, activeProgramId, activateProgram, saveCustomProgram, deleteCustomProgram } = useStore();
  const [seed, setSeed] = useState(0);
  const generated = useMemo(() => generateProgram(profile), [profile, seed]);

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
        <ProgramCard key={p.id} program={p} active={p.id === activeProgramId} recommended={score(p) >= 5} missingEquipment={!canDo(p, profile.equipment)} onActivate={() => activateProgram(p.id)} />
      ))}
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
}: {
  program: Program;
  active: boolean;
  recommended?: boolean;
  missingEquipment?: boolean;
  onActivate: () => void;
  onDelete?: () => void;
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
          {onDelete && (
            <button className="btn sm ghost danger" onClick={onDelete} aria-label="Supprimer">
              <Icon name="trash" size={16} />
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
              {program.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
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
                    <td>
                      <ExerciseLink id={e.exerciseId} />
                    </td>
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

