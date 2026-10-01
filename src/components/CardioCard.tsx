import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cardioStats, dailyTotals } from '../lib/cardio';
import { today, uid, useStore } from '../lib/store';
import { Empty, fmtDate, fmtNum, Icon, Tile } from './ui';

/** Marche sur tapis : saisie des pas + inclinaison, calories et dénivelé estimés. */
export default function CardioCard() {
  const { cardio, profile, body, addCardio, deleteCardio } = useStore();
  const weightKg = body.at(-1)?.weightKg ?? 75;
  const [date, setDate] = useState(today());
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const num = (k: string) => {
    const n = Number((form[k] ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const steps = num('steps');
  const preview = steps ? cardioStats({ id: '', date, steps, inclinePct: num('incline') ?? 0, durationMin: num('duration'), speedKmh: num('speed') }, profile, weightKg) : undefined;

  const save = () => {
    if (!steps || steps > 100000) {
      setMsg('Indique le nombre de pas.');
      return;
    }
    const incline = num('incline') ?? 0;
    if (incline > 30) {
      setMsg('L’inclinaison doit être en % (0 à 30).');
      return;
    }
    addCardio({ id: uid(), date, steps: Math.round(steps), inclinePct: incline, durationMin: num('duration'), speedKmh: num('speed') });
    setForm({ incline: form.incline ?? '', speed: form.speed ?? '' });
    setMsg('Marche enregistrée ✓');
    setTimeout(() => setMsg(''), 2500);
  };

  const days = dailyTotals(cardio, profile, weightKg, 14);
  const week = days.slice(-7);
  const todayTotal = days.at(-1)!;
  const avgSteps = Math.round(week.reduce((s, d) => s + d.steps, 0) / 7);
  const avgKcal = Math.round(week.reduce((s, d) => s + d.kcal, 0) / 7);
  const recent = [...cardio].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8);
  const field = (k: string, label: string, placeholder: string, mode: 'numeric' | 'decimal' = 'decimal') => (
    <label className="field">
      {label}
      <input inputMode={mode} value={form[k] ?? ''} placeholder={placeholder} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="card">
      <div className="card-header">
        <h2>Tapis de marche</h2>
        <span className="small muted">pas du jour + inclinaison</span>
      </div>
      <div className="tiles" style={{ marginBottom: 8 }}>
        <Tile label="Aujourd’hui" value={`${fmtNum(todayTotal.steps, 0)} pas`} sub={todayTotal.steps ? `${todayTotal.kcal} kcal · +${todayTotal.elevationM} m` : 'rien enregistré'} />
        <Tile label="Moyenne par jour (7 j)" value={`${fmtNum(avgSteps, 0)} pas`} sub={`≈ ${avgKcal} kcal/j en marchant`} />
      </div>

      <div className="form-grid">
        <label className="field">
          Date
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {field('steps', 'Nombre de pas *', 'ex. 8000', 'numeric')}
        {field('incline', 'Inclinaison (%)', 'ex. 8')}
        {field('duration', 'Durée (min)', 'facultatif', 'numeric')}
        {field('speed', 'Vitesse (km/h)', 'facultatif')}
      </div>
      {preview && (
        <p className="small secondary" style={{ marginTop: 8 }}>
          ≈ <b>{fmtNum(preview.distanceKm, 2)} km</b> · {preview.durationMin} min à {fmtNum(preview.speedKmh)} km/h · dénivelé <b>+{preview.elevationM} m</b> ·{' '}
          <b>{preview.kcal} kcal</b>
          {preview.estimated && <span className="muted"> (durée/vitesse estimées : saisis-les pour plus de précision)</span>}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>
          Enregistrer
        </button>
        {msg && <span className="small secondary">{msg}</span>}
      </div>

      {cardio.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>14 derniers jours</h3>
          <div className="chart sm">
            <ResponsiveContainer>
              <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: 'numeric' })} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} interval={0} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip content={<StepsTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="steps" name="Pas" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8 }}>
            {recent.map((e) => {
              const st = cardioStats(e, profile, weightKg);
              return (
                <div className="list-item" key={e.id}>
                  <div>
                    <div>
                      {fmtNum(e.steps, 0)} pas · {fmtNum(e.inclinePct)} %
                    </div>
                    <div className="small muted">
                      {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtNum(st.distanceKm, 1)} km · +{st.elevationM} m · {st.kcal} kcal
                    </div>
                  </div>
                  <button className="btn ghost sm" aria-label="Supprimer" onClick={() => confirm('Supprimer cette marche ?') && deleteCardio(e.id)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {cardio.length === 0 && <Empty>Note tes pas sur le tapis pour suivre ta dépense et ton dénivelé.</Empty>}
      <details style={{ marginTop: 8 }}>
        <summary className="small">Comment c’est calculé</summary>
        <p className="small secondary">
          Distance = pas × longueur de pas estimée d’après ta taille (ou vitesse × durée si tu les saisis). Calories nettes (au-delà du repos) avec l’équation de
          marche de l’ACSM, qui tient compte de l’inclinaison : marcher à 10 % double presque la dépense par rapport au plat. Sans durée ni vitesse, l’app suppose une
          cadence de 110 pas/min. Ces calories font partie de ton activité quotidienne : si tu marches beaucoup chaque jour, choisis un niveau d’activité plus élevé
          dans ton profil plutôt que de les « manger » en plus.
        </p>
      </details>
    </div>
  );
}

function StepsTooltip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; steps: number; kcal: number; elevationM: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="t">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div>
        <b>{fmtNum(d.steps, 0)} pas</b>
        {d.steps > 0 && ` · ${d.kcal} kcal · +${d.elevationM} m`}
      </div>
    </div>
  );
}
