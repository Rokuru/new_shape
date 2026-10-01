import { useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { composition, navyBodyFat, weeklyRate, weightTrend } from '../lib/calc';
import { today, uid, useStore } from '../lib/store';
import type { BodyEntry } from '../lib/types';
import { ChartTooltip, Empty, fmtDate, fmtNum, Icon, Legend, Segmented, signed, Tile } from '../components/ui';

type Metric = 'weight' | 'bf' | 'lean' | 'fat' | 'waistCm' | 'armCm' | 'chestCm' | 'thighCm';

const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'weight', label: 'Poids', unit: ' kg' },
  { value: 'bf', label: '% gras', unit: ' %' },
  { value: 'fat', label: 'Masse grasse', unit: ' kg' },
  { value: 'lean', label: 'Masse maigre', unit: ' kg' },
  { value: 'waistCm', label: 'Taille', unit: ' cm' },
  { value: 'armCm', label: 'Bras', unit: ' cm' },
  { value: 'chestCm', label: 'Poitrine', unit: ' cm' },
  { value: 'thighCm', label: 'Cuisse', unit: ' cm' },
];

const FIELDS: { key: keyof BodyEntry; label: string; hint?: string }[] = [
  { key: 'weightKg', label: 'Poids (kg) *', hint: 'le matin, à jeun, après les toilettes' },
  { key: 'bodyFatPct', label: '% masse grasse', hint: 'balance, pince, DEXA… (prioritaire sur le calcul)' },
  { key: 'waistCm', label: 'Tour de taille (cm)', hint: 'au niveau du nombril, relâché' },
  { key: 'neckCm', label: 'Tour de cou (cm)', hint: 'sous la pomme d’Adam' },
  { key: 'hipCm', label: 'Tour de hanches (cm)', hint: 'au plus large des fessiers' },
  { key: 'chestCm', label: 'Poitrine (cm)' },
  { key: 'armCm', label: 'Bras contracté (cm)' },
  { key: 'thighCm', label: 'Cuisse (cm)' },
];

export default function BodyPage() {
  const { profile, body, upsertBody, deleteBody } = useStore();
  const last = body.at(-1);
  const [date, setDate] = useState(today());
  const [form, setForm] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<Metric>('weight');
  const [msg, setMsg] = useState('');
  const [showAll, setShowAll] = useState(false);

  const parsed = (k: string) => {
    const n = Number((form[k] ?? '').replace(',', '.'));
    return n > 0 ? n : undefined;
  };
  const previewBf = navyBodyFat(profile.sex, profile.heightCm, parsed('waistCm'), parsed('neckCm'), parsed('hipCm'));

  const save = () => {
    const weightKg = parsed('weightKg');
    if (!weightKg) {
      setMsg('Le poids est obligatoire.');
      return;
    }
    const entry: BodyEntry = { id: uid(), date, weightKg };
    for (const f of FIELDS) if (f.key !== 'weightKg' && parsed(f.key)) (entry as unknown as Record<string, number>)[f.key] = parsed(f.key)!;
    if (form.note) entry.note = form.note;
    upsertBody(entry);
    setForm({});
    setMsg('Mesure enregistrée ✓');
    setTimeout(() => setMsg(''), 2500);
  };

  const trendByDate = new Map(weightTrend(body).map((t) => [t.date, t.trend]));
  const data = body.map((e) => {
    const c = composition(e, profile);
    return {
      date: e.date,
      weight: e.weightKg,
      trend: trendByDate.get(e.date),
      bf: c.bodyFatPct,
      fat: c.fatKg,
      lean: c.leanKg,
      waistCm: e.waistCm,
      armCm: e.armCm,
      chestCm: e.chestCm,
      thighCm: e.thighCm,
    };
  });
  const m = METRICS.find((x) => x.value === metric)!;
  const series = data.filter((d) => d[metric] !== undefined);
  const comp = last ? composition(last, profile) : undefined;
  const rate = weeklyRate(body);
  const hidden = new Set(profile.sex === 'male' ? ['hipCm'] : []);

  return (
    <div>
      <h1>Composition corporelle</h1>
      {comp && last && (
        <div className="tiles">
          <Tile label="Poids" value={`${fmtNum(last.weightKg)} kg`} sub={rate !== undefined ? `${signed(rate, 2)} kg / sem. (${signed((rate / last.weightKg) * 100, 2)} %)` : `IMC ${fmtNum(comp.bmi)}`} />
          <Tile label="Masse grasse" value={comp.bodyFatPct !== undefined ? `${fmtNum(comp.bodyFatPct)} %` : '—'} sub={comp.fatKg !== undefined ? `${fmtNum(comp.fatKg)} kg` : 'Mesure taille + cou'} />
          <Tile label="Masse maigre" value={comp.leanKg !== undefined ? `${fmtNum(comp.leanKg)} kg` : '—'} sub="muscles, os, eau, organes" />
          <Tile label="FFMI" value={fmtNum(comp.ffmi)} sub={ffmiLabel(comp.ffmi, profile.sex)} />
        </div>
      )}

      <div className="card">
        <h2>Nouvelle mesure</h2>
        <div className="form-grid">
          <label className="field">
            Date
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
          {FIELDS.filter((f) => !hidden.has(f.key)).map((f) => (
            <label className="field" key={f.key} title={f.hint}>
              {f.label}
              <input
                inputMode="decimal"
                value={form[f.key] ?? ''}
                placeholder={last && f.key in last ? String(last[f.key]) : ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {previewBf !== undefined && !parsed('bodyFatPct') && <p className="small secondary" style={{ marginTop: 8 }}>Estimation US Navy : <b>{fmtNum(previewBf)} %</b> de masse grasse.</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={save}>
            Enregistrer
          </button>
          {msg && <span className="small secondary">{msg}</span>}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="small">Conseils de mesure</summary>
          <ul className="small secondary">
            <li>Pèse-toi 3 à 7 fois par semaine dans les mêmes conditions : seule la tendance compte (±1 kg d’eau d’un jour à l’autre est normal).</li>
            <li>Mensurations toutes les 2 semaines, le matin, mètre ruban à plat sans serrer.</li>
            <li>La méthode US Navy a une marge d’erreur de ±3 % mais reste fiable pour suivre une évolution.</li>
            <li>En recomposition, le poids peut stagner alors que le tour de taille baisse et les bras augmentent : c’est une réussite.</li>
          </ul>
        </details>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Évolution</h2>
        </div>
        <div style={{ marginBottom: 10, overflowX: 'auto' }}>
          <Segmented value={metric} options={METRICS.map(({ value, label }) => ({ value, label }))} onChange={setMetric} />
        </div>
        {series.length >= 2 ? (
          <>
            {metric === 'weight' && (
              <Legend
                items={[
                  { label: 'Pesées', color: 'var(--muted)' },
                  { label: 'Tendance lissée', color: 'var(--series-1)' },
                ]}
              />
            )}
            <div className="chart">
              <ResponsiveContainer>
                <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                  <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v, 1)} />
                  <Tooltip content={<ChartTooltip unit={m.unit} />} />
                  {metric === 'weight' ? (
                    <>
                      <Scatter dataKey="weight" name="Pesée" fill="var(--muted)" shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={3} fill="var(--muted)" />} />
                      <Line type="monotone" dataKey="trend" name="Tendance" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </>
                  ) : (
                    <Line type="monotone" dataKey={metric} name={m.label} stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-1)' }} activeDot={{ r: 5 }} connectNulls />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Empty>Il faut au moins 2 mesures de « {m.label} » pour tracer la courbe.</Empty>
        )}
      </div>

      <div className="card">
        <h2>Historique</h2>
        {body.length === 0 ? (
          <Empty>Aucune mesure.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Poids</th>
                  <th className="num">% MG</th>
                  <th className="num">Maigre</th>
                  <th className="num">Taille</th>
                  <th className="num">Bras</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().slice(0, showAll ? undefined : 15).map((d) => (
                  <tr key={d.date}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td className="num">{fmtNum(d.weight)}</td>
                    <td className="num">{fmtNum(d.bf)}</td>
                    <td className="num">{fmtNum(d.lean)}</td>
                    <td className="num">{fmtNum(d.waistCm)}</td>
                    <td className="num">{fmtNum(d.armCm)}</td>
                    <td className="num">
                      <button
                        className="btn ghost sm"
                        aria-label="Supprimer"
                        onClick={() => {
                          const e = body.find((b) => b.date === d.date);
                          if (e && confirm('Supprimer cette mesure ?')) deleteBody(e.id);
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 15 && (
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Afficher moins' : `Afficher les ${data.length} mesures`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ffmiLabel(raw: number | undefined, sex: 'male' | 'female') {
  if (raw === undefined) return 'Nécessite le % de gras';
  // Les repères féminins sont environ 3 points plus bas.
  const ffmi = sex === 'female' ? raw + 3 : raw;
  if (ffmi < 18) return 'Sous la moyenne';
  if (ffmi < 20) return 'Moyenne';
  if (ffmi < 22) return 'Bien entraîné';
  if (ffmi < 24) return 'Très musclé';
  return sex === 'female' ? 'Exceptionnel' : 'Exceptionnel (limite naturelle ≈ 25)';
}
