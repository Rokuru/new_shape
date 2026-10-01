import { BIA_FIELDS, biaTrend, hasBia, metabolicAgeStatus, PHYSIQUE_LABELS, SEGMENTS, segmentAnalysis, visceralStatus, waterStatus } from '../lib/bia';
import type { BodyEntry, Profile } from '../lib/types';
import { fmtDate, fmtNum, signed, Tile } from './ui';

type Form = Record<string, string>;

/** Saisie des valeurs de la balance, dans l'ordre où la BC-545N les affiche. */
export function BiaFields({ form, setForm, last }: { form: Form; setForm: (f: Form) => void; last?: BodyEntry }) {
  const input = (key: string, label: string, placeholder?: number, step?: string) => (
    <label className="field" key={key}>
      {label}
      <input
        inputMode={step === '1' ? 'numeric' : 'decimal'}
        value={form[key] ?? ''}
        placeholder={placeholder !== undefined ? String(placeholder) : ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div className="form-grid">{BIA_FIELDS.map((f) => input(`bia.${f.key}`, f.label, last?.bia?.[f.key], f.step))}</div>
      <details>
        <summary className="small">Analyse segmentaire (bras, jambes, tronc)</summary>
        <p className="small muted" style={{ margin: '6px 0' }}>
          Sur la balance, fais défiler les résultats segmentaires : % de gras puis masse musculaire de chaque segment.
        </p>
        <div className="seg-grid">
          <span />
          <span className="small muted">% gras</span>
          <span className="small muted">Muscle (kg)</span>
          {SEGMENTS.map((s) => (
            <SegRow key={s.key} label={s.label}>
              {input(`segFat.${s.key}`, '', last?.bia?.segFat?.[s.key])}
              {input(`segMuscle.${s.key}`, '', last?.bia?.segMuscle?.[s.key])}
            </SegRow>
          ))}
        </div>
      </details>
    </div>
  );
}

function SegRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="small">{label}</span>
      {children}
    </>
  );
}

/** Construit l'objet BIA à partir du formulaire ; undefined si rien n'a été saisi. */
export function readBia(form: Form): BodyEntry['bia'] {
  const num = (k: string) => {
    const n = Number((form[k] ?? '').replace(',', '.'));
    return n > 0 ? n : undefined;
  };
  const bia: NonNullable<BodyEntry['bia']> = {};
  for (const f of BIA_FIELDS) {
    const v = num(`bia.${f.key}`);
    if (v !== undefined && v >= f.min && v <= f.max) bia[f.key] = v;
  }
  for (const kind of ['segFat', 'segMuscle'] as const) {
    const seg: Record<string, number> = {};
    for (const s of SEGMENTS) {
      const v = num(`${kind}.${s.key}`);
      if (v !== undefined) seg[s.key] = v;
    }
    if (Object.keys(seg).length) bia[kind] = seg;
  }
  return Object.keys(bia).length ? bia : undefined;
}

/** Tableau de bord des mesures Tanita : dernière mesure, tendance du muscle, analyse segmentaire. */
export default function BiaPanel({ body, profile }: { body: BodyEntry[]; profile: Profile }) {
  const entries = body.filter(hasBia).sort((a, b) => a.date.localeCompare(b.date));
  const last = entries.at(-1);
  if (!last?.bia) return null;
  const b = last.bia;
  const muscleTrend = biaTrend(entries, (e) => e.bia?.muscleKg);
  const firstMuscle = [...muscleTrend.values()][0];
  const lastMuscle = [...muscleTrend.values()].at(-1);
  const seg = segmentAnalysis(entries);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Balance Tanita</h2>
        <span className="small muted">dernière mesure le {fmtDate(last.date, { day: 'numeric', month: 'long' })}</span>
      </div>
      <div className="tiles" style={{ marginBottom: 8 }}>
        {b.muscleKg !== undefined && (
          <Tile
            label="Masse musculaire"
            value={`${fmtNum(b.muscleKg)} kg`}
            sub={lastMuscle !== undefined && firstMuscle !== undefined && muscleTrend.size > 1 ? `tendance ${signed(lastMuscle - firstMuscle)} kg depuis le ${fmtDate(entries[0].date)}` : 'muscles + eau qu’ils contiennent'}
          />
        )}
        {last.bodyFatPct !== undefined && <Tile label="% gras (Tanita)" value={`${fmtNum(last.bodyFatPct)} %`} sub={`${fmtNum((last.weightKg * last.bodyFatPct) / 100)} kg`} />}
        {b.waterPct !== undefined && <Tile label="Eau" value={`${fmtNum(b.waterPct)} %`} sub={<Status {...waterStatus(b.waterPct, profile.sex)} />} />}
        {b.visceral !== undefined && <Tile label="Graisse viscérale" value={fmtNum(b.visceral)} sub={<Status {...visceralStatus(b.visceral)} />} />}
        {b.physique !== undefined && <Tile label="Masse physique" value={String(b.physique)} sub={PHYSIQUE_LABELS[Math.round(b.physique)]} />}
        {b.metabolicAge !== undefined && <Tile label="Âge métabolique" value={`${b.metabolicAge} ans`} sub={<Status {...metabolicAgeStatus(b.metabolicAge, profile)} />} />}
        {b.boneKg !== undefined && <Tile label="Masse osseuse" value={`${fmtNum(b.boneKg)} kg`} sub="stable chez l’adulte" />}
        {b.kcal !== undefined && <Tile label="Calories (balance)" value={`${fmtNum(b.kcal, 0)} kcal`} sub="à comparer à l’onglet Nutrition" />}
      </div>

      {seg && (
        <>
          <h3 style={{ marginTop: 8 }}>Analyse segmentaire</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th className="num">% gras</th>
                  <th className="num">Muscle</th>
                  <th className="num">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {seg.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td className="num">{fmtNum(r.fatPct)}</td>
                    <td className="num">{r.muscleKg !== undefined ? `${fmtNum(r.muscleKg)} kg` : '—'}</td>
                    <td className={`num ${r.muscleDelta === undefined ? '' : r.muscleDelta >= 0 ? 'delta-good' : 'delta-bad'}`}>
                      {r.muscleDelta !== undefined ? `${signed(r.muscleDelta)} kg` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {seg.asymmetries.map((a) => (
            <div className="callout" key={a} style={{ marginTop: 8 }}>
              ⚖️ {a}
            </div>
          ))}
        </>
      )}

      <details style={{ marginTop: 12 }}>
        <summary className="small">Bien utiliser la bio-impédance</summary>
        <ul className="small secondary">
          <li>
            La balance estime la composition à partir de la résistance électrique du corps : elle dépend fortement de l’<b>hydratation</b>. Mesure-toi toujours dans les mêmes
            conditions : le matin, à jeun, après être allé aux toilettes, pieds propres et secs, avant la douche et le sport.
          </li>
          <li>Évite les mesures après l’entraînement, l’alcool, un repas salé ou le sauna : le % de gras peut varier de 2 à 3 points en une journée.</li>
          <li>
            Si tu t’entraînes plus de 10 h par semaine avec un pouls au repos ≤ 60, active le <b>mode Athlète</b> de la balance (sinon le % de gras est surestimé). Garde le
            même mode tout au long du suivi.
          </li>
          <li>
            La <b>masse musculaire</b> Tanita inclut l’eau des muscles : elle ne se compare pas à la « masse maigre » calculée ailleurs (poids − graisse). Fie-toi à la
            tendance sur plusieurs semaines, pas à une mesure isolée.
          </li>
          <li>Ne compare pas un % de gras Tanita à un % calculé au mètre ruban : ce sont deux méthodes différentes, l’app les trace sur des courbes séparées.</li>
        </ul>
      </details>
    </div>
  );
}

function Status({ level, label }: { level: 'ok' | 'warn' | 'bad'; label: string }) {
  return (
    <span className={`status ${level}`}>
      {level === 'ok' ? '✓' : '⚠'} {label}
    </span>
  );
}
