import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getExercise } from '../data/exercises';
import { bestE1rm, e1rm, startOfWeek, tonnage, weeklyVolume } from '../lib/calc';
import { useStore } from '../lib/store';
import { ChartTooltip, Empty, fmtDate, fmtNum, Legend } from '../components/ui';
import VolumeBars from '../components/VolumeBars';

export default function ProgressPage() {
  const { workouts } = useStore();
  const sorted = useMemo(() => [...workouts].filter((w) => w.finished).sort((a, b) => a.date.localeCompare(b.date)), [workouts]);

  const exerciseIds = useMemo(() => {
    const count = new Map<string, number>();
    for (const w of sorted) for (const e of w.exercises) count.set(e.exerciseId, (count.get(e.exerciseId) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [sorted]);
  const [selected, setSelected] = useState<string>('');
  const exId = selected || exerciseIds[0];

  const e1rmSeries = exId
    ? sorted
        .map((w) => ({ date: w.date.slice(0, 10), e1rm: bestE1rm(w, exId) }))
        .filter((d) => d.e1rm > 0)
    : [];

  const weeks = useMemo(() => {
    const out: { week: string; tonnage: number; sessions: number }[] = [];
    const start = startOfWeek(new Date());
    for (let i = 11; i >= 0; i--) {
      const from = new Date(start);
      from.setDate(from.getDate() - i * 7);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const ws = sorted.filter((w) => {
        const t = new Date(w.date).getTime();
        return t >= from.getTime() && t < to.getTime();
      });
      out.push({ week: from.toISOString().slice(0, 10), tonnage: Math.round(ws.reduce((s, w) => s + tonnage(w), 0) / 100) / 10, sessions: ws.length });
    }
    return out;
  }, [sorted]);

  const records = exerciseIds
    .map((id) => {
      let best = { v: 0, weight: 0, reps: 0, date: '' };
      for (const w of sorted)
        for (const e of w.exercises)
          if (e.exerciseId === id)
            for (const s of e.sets) {
              const v = s.done ? e1rm(s.weight, s.reps) : 0;
              if (v > best.v) best = { v, weight: s.weight, reps: s.reps, date: w.date };
            }
      return { id, ...best };
    })
    .filter((r) => r.v > 0);

  if (sorted.length === 0) {
    return (
      <div>
        <h1>Progrès</h1>
        <div className="card">
          <Empty>Termine ta première séance pour voir tes courbes de force et ton volume d’entraînement.</Empty>
        </div>
      </div>
    );
  }

  const first = e1rmSeries[0]?.e1rm;
  const lastV = e1rmSeries.at(-1)?.e1rm;

  return (
    <div>
      <h1>Progrès</h1>

      <div className="card">
        <div className="card-header">
          <h2>Force – 1RM estimé</h2>
          <select value={exId} onChange={(e) => setSelected(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }} aria-label="Exercice">
            {exerciseIds.map((id) => (
              <option key={id} value={id}>
                {getExercise(id).name}
              </option>
            ))}
          </select>
        </div>
        {first !== undefined && lastV !== undefined && e1rmSeries.length > 1 && (
          <p className="small secondary">
            {fmtNum(first)} → <b>{fmtNum(lastV)} kg</b> ({lastV >= first ? '+' : ''}
            {fmtNum(((lastV - first) / first) * 100)} %) sur {e1rmSeries.length} séances
          </p>
        )}
        {e1rmSeries.length >= 2 ? (
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={e1rmSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" kg" />} />
                <Line type="monotone" dataKey="e1rm" name="1RM estimé" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-1)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>Encore une séance avec cet exercice pour tracer la courbe.</Empty>
        )}
        <p className="small muted">1RM estimé avec la formule d’Epley sur la meilleure série de chaque séance.</p>
      </div>

      <div className="card">
        <h2>Volume des 7 derniers jours</h2>
        <p className="small secondary">
          Séries par muscle (1 pour un muscle principal, ½ pour un secondaire), comparées aux repères de Mike Israetel (RP). Vise la zone bleue ; au-dessus du MRV, la
          récupération devient difficile.
        </p>
        <VolumeBars volume={weeklyVolume(sorted)} />
      </div>

      <div className="card">
        <h2>Tonnage hebdomadaire</h2>
        <Legend items={[{ label: 'Tonnes soulevées (charge × reps)', color: 'var(--series-1)' }]} />
        <div className="chart sm">
          <ResponsiveContainer>
            <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="week" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<WeekTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="tonnage" name="Tonnage" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Records personnels</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Exercice</th>
                <th className="num">Meilleure série</th>
                <th className="num">1RM est.</th>
                <th className="num">Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{getExercise(r.id).name}</td>
                  <td className="num">
                    {fmtNum(r.weight)} × {r.reps}
                  </td>
                  <td className="num">{fmtNum(r.v)}</td>
                  <td className="num">{fmtDate(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: { week: string; tonnage: number; sessions: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="t">Semaine du {fmtDate(d.week, { day: 'numeric', month: 'long' })}</div>
      <div>
        <b>{fmtNum(d.tonnage)} t</b> · {d.sessions} séance{d.sessions > 1 ? 's' : ''}
      </div>
    </div>
  );
}
