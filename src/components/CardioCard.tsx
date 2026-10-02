import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cardioStats, dailyTotals, isValidCardio, type DayTotal } from '../lib/cardio';
import { uid, useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import type { CardioEntry } from '../lib/types';
import { Empty, fmtDate, fmtNum, Icon, Segmented, Tile } from './ui';

type Mode = 'tapis' | 'pas';
const MODE_KEY = 'new-shape-cardio-mode';
const readMode = (): Mode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'pas' ? 'pas' : 'tapis';
  } catch {
    return 'tapis';
  }
};

/**
 * Marche : soit au tapis (vitesse + durée + inclinaison), soit au podomètre / à la montre (nombre de pas).
 * Il suffit de l'un ou de l'autre ; l'app calcule le reste.
 */
export default function CardioCard() {
  const { cardio, profile, body, addCardio, deleteCardio } = useStore();
  const weightKg = body.at(-1)?.weightKg ?? 75;
  const todayKey = useToday();
  const [picked, setDate] = useState<string>();
  // Sans choix explicite, la date suit le jour courant (même si l'app est restée ouverte depuis la veille).
  const date = picked ?? todayKey;
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* stockage indisponible */
    }
  };
  const num = (k: string) => {
    const n = Number((form[k] ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const draft: CardioEntry = { id: '', date, inclinePct: num('incline') ?? 0, speedKmh: mode === 'tapis' ? num('speed') : undefined, durationMin: num('duration'), steps: num('steps') };
  const preview = isValidCardio(draft) ? cardioStats(draft, profile, weightKg) : undefined;

  const save = () => {
    // Safari iOS n'applique pas l'attribut max du sélecteur de date : on refuse ici une date future.
    if (date > todayKey) {
      setMsg('La date est dans le futur : choisis aujourd’hui ou un jour passé.');
      return;
    }
    if (!isValidCardio(draft)) {
      setMsg(mode === 'tapis' ? 'Indique la vitesse et la durée (ou passe en mode « Pas » si tu n’as que tes pas).' : 'Indique ton nombre de pas.');
      return;
    }
    if (draft.inclinePct > 30 || (draft.speedKmh ?? 0) > 25 || (draft.durationMin ?? 0) > 600) {
      setMsg('Valeur hors limites : inclinaison en % (0–30), vitesse en km/h, durée en minutes.');
      return;
    }
    addCardio({ ...draft, id: uid(), steps: draft.steps ? Math.round(draft.steps) : undefined });
    // On garde vitesse et inclinaison : elles changent rarement d'une séance à l'autre.
    setForm(mode === 'tapis' ? { speed: form.speed ?? '', incline: form.incline ?? '' } : {});
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
        <h2>Marche</h2>
        
      </div>
      <div className="tiles" style={{ marginBottom: 8 }}>
        <Tile
          label="Aujourd’hui"
          value={`${todayTotal.kcal} kcal`}
          sub={todayTotal.minutes ? `${fmtNum(todayTotal.steps, 0)} pas · ${fmtNum(todayTotal.distanceKm, 1)} km${todayTotal.elevationM ? ` · +${todayTotal.elevationM} m` : ''}` : 'rien enregistré'}
        />
        <Tile label="Moyenne / jour (7 j)" value={`${Math.round(avg('kcal'))} kcal`} sub={`${fmtNum(avg('steps'), 0)} pas · ${fmtNum(avg('distanceKm'), 1)} km`} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'tapis', label: 'Tapis (vitesse)' },
            { value: 'pas', label: 'Montre / podomètre (pas)' },
          ]}
        />
      </div>
      <div className="form-grid">
        <label className="field">
          Date
          <input type="date" value={date} max={todayKey} onChange={(e) => setDate(e.target.value)} />
        </label>
        {mode === 'tapis' ? (
          <>
            {field('speed', 'Vitesse (km/h)', 'ex. 5,5')}
            {field('duration', 'Durée (min)', 'ex. 45', 'numeric')}
            {field('incline', 'Inclinaison (%)', 'ex. 10')}
            {field('steps', 'Nombre de pas', 'facultatif', 'numeric')}
          </>
        ) : (
          <>
            {field('steps', 'Nombre de pas', 'ex. 9000', 'numeric')}
            {field('duration', 'Durée de marche (min)', 'facultatif', 'numeric')}
            {field('incline', 'Pente / inclinaison (%)', 'facultatif')}
          </>
        )}
      </div>
      {preview && (
        <p className="small secondary" style={{ marginTop: 8 }}>
          ≈ <b>{fmtNum(preview.distanceKm, 2)} km</b>
          {preview.elevationM > 0 && (
            <>
              {' '}
              · dénivelé <b>+{preview.elevationM} m</b>
            </>
          )}{' '}
          · <b>{preview.kcal} kcal</b> · {preview.stepsEstimated ? '≈ ' : ''}
          {fmtNum(preview.steps, 0)} pas
          {mode === 'pas' && !draft.durationMin && <span className="muted"> (ajoute la durée de marche pour affiner les calories)</span>}
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
                      {e.speedKmh ? `${st.durationMin} min à ${fmtNum(st.speedKmh)} km/h` : `${fmtNum(st.steps, 0)} pas`}
                      {e.inclinePct ? ` · ${fmtNum(e.inclinePct)} %` : ''}
                    </div>
                    <div className="small muted">
                      {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtNum(st.distanceKm, 1)} km{st.elevationM ? ` · +${st.elevationM} m` : ''} · {st.kcal} kcal
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
      {recent.length === 0 && <Empty>Note ta marche (tapis ou pas de ta montre) pour suivre ta dépense et ta distance.</Empty>}
      <details style={{ marginTop: 8 }}>
        <summary className="small">Comment c’est calculé</summary>
        <p className="small secondary">
          Au tapis : distance = vitesse × durée. Avec ta montre : distance = pas × longueur de pas estimée d’après ta taille. Calories nettes (au-delà du repos) avec l’équation de marche de l’ACSM, qui tient compte de l’inclinaison : marcher à 10 %
          multiplie la dépense par près de 3 par rapport au plat. Au tapis, les pas sont estimés ; avec les pas seuls, l’app suppose une cadence de 110 pas/min
          si tu ne donnes pas la durée. Ces calories sont ajoutées automatiquement à ta cible de l’onglet Nutrition, en moyenne
          sur 14 jours : pas besoin de les « manger » en plus.
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
            <b>{d.kcal} kcal</b> · {fmtNum(d.steps, 0)} pas · {fmtNum(d.distanceKm, 1)} km{d.elevationM ? ` · +${d.elevationM} m` : ''}
          </>
        ) : (
          'Aucune marche'
        )}
      </div>
    </div>
  );
}
