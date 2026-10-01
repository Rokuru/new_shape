import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cardioStats, dailyTotals, isValidCardio, type DayTotal } from '../lib/cardio';
import { today, uid, useStore } from '../lib/store';
import type { CardioEntry } from '../lib/types';
import { Empty, fmtDate, fmtNum, Icon, Tile } from './ui';

/** Marche sur tapis : vitesse + durée + inclinaison (pas facultatifs) → distance, dénivelé, calories. */
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
  const draft: CardioEntry = { id: '', date, inclinePct: num('incline') ?? 0, speedKmh: num('speed'), durationMin: num('duration'), steps: num('steps') };
  const preview = isValidCardio(draft) ? cardioStats(draft, profile, weightKg) : undefined;

  const save = () => {
    if (!isValidCardio(draft)) {
      setMsg('Indique la vitesse et la durée (ou ton nombre de pas).');
      return;
    }
    if (draft.inclinePct > 30 || (draft.speedKmh ?? 0) > 25 || (draft.durationMin ?? 0) > 600) {
      setMsg('Valeur hors limites : inclinaison en % (0–30), vitesse en km/h, durée en minutes.');
      return;
    }
    addCardio({ ...draft, id: uid(), steps: draft.steps ? Math.round(draft.steps) : undefined });
    // On garde vitesse et inclinaison : elles changent rarement d'une séance à l'autre.
    setForm({ speed: form.speed ?? '', incline: form.incline ?? '' });
    setMsg('Marche enregistrée ✓');
    setTimeout(() => setMsg(''), 2500);
  };

  const days = dailyTotals(cardio, profile, weightKg, 14);
  const week = days.slice(-7);
  const todayTotal = days.at(-1)!;
  const avg = (k: keyof Omit<DayTotal, 'date'>) => week.reduce((s, d) => s + d[k], 0) / 7;
  const recent = [...cardio].filter(isValidCardio).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8);
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
        
      </div>
      <div className="tiles" style={{ marginBottom: 8 }}>
        <Tile
          label="Aujourd’hui"
          value={`${todayTotal.kcal} kcal`}
          sub={todayTotal.minutes ? `${todayTotal.minutes} min · ${fmtNum(todayTotal.distanceKm, 1)} km · +${todayTotal.elevationM} m` : 'rien enregistré'}
        />
        <Tile label="Moyenne / jour (7 j)" value={`${Math.round(avg('kcal'))} kcal`} sub={`${Math.round(avg('minutes'))} min · ${fmtNum(avg('distanceKm'), 1)} km`} />
      </div>

      <div className="form-grid">
        <label className="field">
          Date
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {field('speed', 'Vitesse (km/h) *', 'ex. 5,5')}
        {field('duration', 'Durée (min) *', 'ex. 45', 'numeric')}
        {field('incline', 'Inclinaison (%)', 'ex. 10')}
        {field('steps', 'Nombre de pas', 'facultatif', 'numeric')}
      </div>
      {preview && (
        <p className="small secondary" style={{ marginTop: 8 }}>
          ≈ <b>{fmtNum(preview.distanceKm, 2)} km</b> · dénivelé <b>+{preview.elevationM} m</b> · <b>{preview.kcal} kcal</b> · {preview.stepsEstimated ? '≈ ' : ''}
          {fmtNum(preview.steps, 0)} pas
          {preview.estimated && <span className="muted"> (calculé à partir des pas : saisis vitesse et durée pour plus de précision)</span>}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>
          Enregistrer
        </button>
        {msg && <span className="small secondary">{msg}</span>}
      </div>

      {recent.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Calories dépensées – 14 derniers jours</h3>
          <div className="chart sm">
            <ResponsiveContainer>
              <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: 'numeric' })} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} interval={0} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<DayTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="kcal" name="kcal" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
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
                      {st.durationMin} min à {fmtNum(st.speedKmh)} km/h · {fmtNum(e.inclinePct)} %
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
      {recent.length === 0 && <Empty>Note ta vitesse, ta durée et l’inclinaison du tapis pour suivre ta dépense et ton dénivelé.</Empty>}
      <details style={{ marginTop: 8 }}>
        <summary className="small">Comment c’est calculé</summary>
        <p className="small secondary">
          Distance = vitesse × durée. Calories nettes (au-delà du repos) avec l’équation de marche de l’ACSM, qui tient compte de l’inclinaison : marcher à 10 %
          multiplie la dépense par près de 3 par rapport au plat. Les pas sont estimés d’après la longueur de pas liée à ta taille ; si tu n’as que le nombre de pas,
          l’app en déduit la distance (cadence supposée de 110 pas/min). Ces calories font partie de ton activité quotidienne : si tu marches beaucoup chaque jour,
          choisis un niveau d’activité plus élevé dans ton profil plutôt que de les « manger » en plus.
        </p>
      </details>
    </div>
  );
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayTotal }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="t">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div>
        {d.minutes ? (
          <>
            <b>{d.kcal} kcal</b> · {d.minutes} min · {fmtNum(d.distanceKm, 1)} km · +{d.elevationM} m
          </>
        ) : (
          'Pas de tapis'
        )}
      </div>
    </div>
  );
}
