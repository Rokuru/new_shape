import { useState } from 'react';
import { composition, type Composition } from '../lib/calc';
import { BIA_FIELDS, PHYSIQUE_LABELS, SEGMENTS } from '../lib/bia';
import { BODY_FIELDS, buildBodyEntry, entryToForm } from '../lib/bodyForm';
import { useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import type { BodyEntry, Profile } from '../lib/types';
import { BiaFields } from './BiaPanel';
import Sheet from './Sheet';
import { Empty, fmtDate, fmtNum, Icon } from './ui';

type ColKey =
  | 'weight'
  | 'bf'
  | 'fatKg'
  | 'lean'
  | 'muscle'
  | 'water'
  | 'visceral'
  | 'metabolicAge'
  | 'bone'
  | 'waistCm'
  | 'neckCm'
  | 'hipCm'
  | 'chestCm'
  | 'armCm'
  | 'thighCm';

const COLUMNS: { key: ColKey; label: string; get: (e: BodyEntry, c: Composition) => number | undefined; d?: number }[] = [
  { key: 'weight', label: 'Poids', get: (e) => e.weightKg },
  { key: 'bf', label: '% MG', get: (_, c) => c.bodyFatPct },
  { key: 'fatKg', label: 'Gras (kg)', get: (_, c) => c.fatKg },
  { key: 'lean', label: 'Maigre', get: (_, c) => c.leanKg },
  { key: 'muscle', label: 'Muscle', get: (e) => e.bia?.muscleKg },
  { key: 'water', label: 'Eau %', get: (e) => e.bia?.waterPct },
  { key: 'visceral', label: 'Viscéral', get: (e) => e.bia?.visceral },
  { key: 'metabolicAge', label: 'Âge méta.', get: (e) => e.bia?.metabolicAge, d: 0 },
  { key: 'bone', label: 'Os', get: (e) => e.bia?.boneKg },
  { key: 'waistCm', label: 'Taille', get: (e) => e.waistCm },
  { key: 'neckCm', label: 'Cou', get: (e) => e.neckCm },
  { key: 'hipCm', label: 'Hanches', get: (e) => e.hipCm },
  { key: 'chestCm', label: 'Poitrine', get: (e) => e.chestCm },
  { key: 'armCm', label: 'Bras', get: (e) => e.armCm },
  { key: 'thighCm', label: 'Cuisse', get: (e) => e.thighCm },
];

const COLS_KEY = 'new-shape-history-cols';
const PAGE = 15;

function loadCols(): ColKey[] | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(COLS_KEY) ?? 'null');
    if (Array.isArray(raw)) return raw.filter((k): k is ColKey => COLUMNS.some((c) => c.key === k));
  } catch {
    /* stockage indisponible */
  }
  return undefined;
}

/** Historique des mesures : colonnes au choix, détail complet et modification d'une mesure. */
export default function BodyHistory({ body, profile }: { body: BodyEntry[]; profile: Profile }) {
  const deleteBody = useStore((s) => s.deleteBody);
  const [showAll, setShowAll] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const [saved, setSavedState] = useState<ColKey[] | undefined>(loadCols);

  const rows = [...body].reverse().map((e) => ({ e, c: composition(e, profile) }));
  const count = (k: ColKey) => rows.filter(({ e, c }) => COLUMNS.find((x) => x.key === k)!.get(e, c) !== undefined).length;
  // Par défaut : poids, % de gras, et muscle (balance) ou masse maigre. Le choix de l'utilisateur est mémorisé.
  const defaults: ColKey[] = ['weight', 'bf', count('muscle') ? 'muscle' : 'lean'];
  const cols = COLUMNS.filter((c) => (saved ?? defaults).includes(c.key));
  const setCols = (next: ColKey[]) => {
    setSavedState(next);
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible */
    }
  };
  const toggle = (k: ColKey) => {
    const cur = cols.map((c) => c.key);
    setCols(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  };

  const remove = (e: BodyEntry) => {
    if (confirm(`Supprimer la mesure du ${fmtDate(e.date, { day: 'numeric', month: 'long', year: 'numeric' })} ?`)) {
      deleteBody(e.id);
      setOpenId(undefined);
    }
  };

  const opened = body.find((e) => e.id === openId);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Historique</h2>
        {body.length > 0 && (
          <button className={`btn sm ${filterOpen ? 'primary' : 'ghost'}`} onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen}>
            <Icon name="filter" size={16} /> Colonnes
          </button>
        )}
      </div>

      {filterOpen && (
        <div className="col-filter">
          <div className="chips" role="group" aria-label="Colonnes affichées">
            {COLUMNS.map((c) => {
              const n = count(c.key);
              const on = cols.some((x) => x.key === c.key);
              return (
                <button key={c.key} type="button" className={`chip ${on ? 'on' : ''} ${n ? '' : 'no-data'}`} aria-pressed={on} onClick={() => toggle(c.key)} title={n ? `${n} mesure(s)` : 'aucune donnée'}>
                  {c.label}
                  <span className="chip-count">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setCols(COLUMNS.filter((c) => count(c.key)).map((c) => c.key))}>
              Tout ce qui est renseigné
            </button>
            <button className="btn ghost sm" onClick={() => setCols(defaults)}>
              Par défaut
            </button>
          </div>
        </div>
      )}

      {body.length === 0 ? (
        <Empty>Aucune mesure.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="history">
            <thead>
              <tr>
                <th>Date</th>
                {cols.map((c) => (
                  <th key={c.key} className="num">
                    {c.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, showAll ? undefined : PAGE).map(({ e, c }) => (
                <tr
                  key={e.id}
                  className="clickable"
                  tabIndex={0}
                  aria-label={`Voir la mesure du ${fmtDate(e.date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  onClick={() => setOpenId(e.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setOpenId(e.id);
                    }
                  }}
                >
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(e.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {e.bia && <span className="dot-bia" title="Mesure balance" />}
                  </td>
                  {cols.map((col) => (
                    <td key={col.key} className="num">
                      {fmtNum(col.get(e, c), col.d ?? 1)}
                    </td>
                  ))}
                  <td className="num row-chevron" aria-hidden>
                    <Icon name="chevron" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > PAGE && (
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Afficher moins' : `Afficher les ${rows.length} mesures`}
            </button>
          )}
        </div>
      )}

      {opened && <EntrySheet key={opened.id} entry={opened} body={body} profile={profile} onClose={() => setOpenId(undefined)} onDelete={() => remove(opened)} onMoved={setOpenId} />}
    </div>
  );
}

function EntrySheet({
  entry,
  body,
  profile,
  onClose,
  onDelete,
  onMoved,
}: {
  entry: BodyEntry;
  body: BodyEntry[];
  profile: Profile;
  onClose: () => void;
  onDelete: () => void;
  onMoved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const title = fmtDate(entry.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Sheet title={title} kicker={editing ? 'Modifier la mesure' : entry.bia ? 'Mesure balance' : 'Mesure'} onClose={onClose}>
      {editing ? (
        <EntryEditor entry={entry} body={body} profile={profile} onDone={(id) => (setEditing(false), onMoved(id))} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <EntryDetail entry={entry} profile={profile} />
          <div className="row" style={{ marginTop: 18, gap: 8 }}>
            <button className="btn primary" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} /> Modifier
            </button>
            <button className="btn ghost danger" onClick={onDelete}>
              <Icon name="trash" size={16} /> Supprimer
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function KV({ items }: { items: [string, string | undefined][] }) {
  const shown = items.filter(([, v]) => v !== undefined);
  if (!shown.length) return null;
  return (
    <dl className="kv">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const u = (n: number | undefined, unit: string, d = 1) => (n === undefined ? undefined : `${fmtNum(n, d)}${unit}`);

function EntryDetail({ entry: e, profile }: { entry: BodyEntry; profile: Profile }) {
  const c = composition(e, profile);
  const b = e.bia;
  const hasSeg = SEGMENTS.some((s) => b?.segFat?.[s.key] !== undefined || b?.segMuscle?.[s.key] !== undefined);
  return (
    <div className="stack">
      <KV
        items={[
          ['Poids', u(e.weightKg, ' kg')],
          [b ? '% gras (balance)' : '% gras', u(c.bodyFatPct, ' %')],
          ['Masse grasse', u(c.fatKg, ' kg')],
          ['Masse maigre', u(c.leanKg, ' kg')],
          ['FFMI', u(c.ffmi, '')],
          ['IMC', u(c.bmi, '')],
        ]}
      />
      {BODY_FIELDS.some((f) => f.key.endsWith('Cm') && e[f.key] !== undefined) && (
        <>
          <h3>Mensurations</h3>
          <KV items={BODY_FIELDS.filter((f) => f.key.endsWith('Cm')).map((f) => [f.label.replace(' (cm)', ''), u(e[f.key] as number | undefined, ' cm')])} />
        </>
      )}
      {b && BIA_FIELDS.some((f) => b[f.key] !== undefined) && (
        <>
          <h3>Balance</h3>
          <KV
            items={BIA_FIELDS.map((f) => {
              const v = b[f.key];
              const label = f.label.replace(/ \(.*\)$/, '');
              if (v === undefined) return [label, undefined];
              if (f.key === 'physique') return [label, `${v} · ${PHYSIQUE_LABELS[Math.round(v)] ?? ''}`];
              if (f.key === 'metabolicAge') return [label, `${v} ans`];
              const unit = f.label.includes('(kg)') ? ' kg' : f.label.includes('(kcal)') ? ' kcal' : f.key === 'waterPct' ? ' %' : '';
              return [label, u(v, unit, f.key === 'kcal' ? 0 : 1)];
            })}
          />
        </>
      )}
      {hasSeg && (
        <>
          <h3>Analyse segmentaire</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th className="num">% gras</th>
                  <th className="num">Muscle</th>
                </tr>
              </thead>
              <tbody>
                {SEGMENTS.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td className="num">{fmtNum(b?.segFat?.[s.key])}</td>
                    <td className="num">{u(b?.segMuscle?.[s.key], ' kg') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {e.note && (
        <>
          <h3>Note</h3>
          <p className="secondary" style={{ margin: 0 }}>
            {e.note}
          </p>
        </>
      )}
    </div>
  );
}

function EntryEditor({ entry, body, profile, onDone, onCancel }: { entry: BodyEntry; body: BodyEntry[]; profile: Profile; onDone: (id: string) => void; onCancel: () => void }) {
  const upsertBody = useStore((s) => s.upsertBody);
  const todayKey = useToday();
  const [form, setForm] = useState(() => entryToForm(entry));
  const [date, setDate] = useState(entry.date);
  const [tanita, setTanita] = useState(!!entry.bia);
  const [msg, setMsg] = useState('');
  const hidden = new Set(profile.sex === 'male' && entry.hipCm === undefined ? ['hipCm'] : []);
  const hasSeg = SEGMENTS.some((s) => entry.bia?.segFat?.[s.key] !== undefined || entry.bia?.segMuscle?.[s.key] !== undefined);

  const save = () => {
    const res = buildBodyEntry(form, { id: entry.id, date, todayKey, tanita });
    if ('error' in res) return setMsg(res.error);
    const clash = body.find((b) => b.id !== entry.id && b.date === date);
    if (clash && !confirm(`Une mesure existe déjà le ${fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })} : elle sera remplacée. Continuer ?`)) return;
    upsertBody(res.entry);
    onDone(res.entry.id);
  };

  return (
    <div>
      <div className="form-grid">
        <label className="field">
          Date
          <input type="date" value={date} max={todayKey} onChange={(e) => setDate(e.target.value)} />
        </label>
        {BODY_FIELDS.filter((f) => !hidden.has(f.key)).map((f) => (
          <label className="field" key={f.key}>
            {f.key === 'bodyFatPct' && tanita ? '% masse grasse (balance)' : f.label}
            <input inputMode="decimal" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <label className="small" style={{ marginTop: 12, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="checkbox" checked={tanita} onChange={(e) => setTanita(e.target.checked)} style={{ width: 20, height: 20, minHeight: 0, flexShrink: 0 }} />
        <span>Mesure avec ma balance</span>
      </label>
      {tanita && <BiaFields form={form} setForm={setForm} openSegments={hasSeg} />}
      <label className="field" style={{ marginTop: 12 }}>
        Note
        <input value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="optionnel" />
      </label>
      {msg && (
        <p className="field-error" role="alert" style={{ marginTop: 10 }}>
          {msg}
        </p>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={save}>
          Enregistrer
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
