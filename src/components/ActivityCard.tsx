import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useToday } from '../hooks/useToday';
import { activityAverage, dailyActivity, energyBasis, type DayActivity } from '../lib/energy';
import { useStore } from '../lib/store';
import { Empty, fmtDate, fmtNum, Legend } from './ui';

const TRAINING = 'var(--series-1)';
const WALKING = 'var(--series-2)';

/**
 * Calories dépensées par jour sur 14 jours : musculation et marche empilées, deux couleurs.
 * Mêmes calculs que la cible de l'onglet Nutrition.
 */
export default function ActivityCard() {
  const { workouts, cardio, profile, body } = useStore();
  useToday(); // nouveau jour : le graphique glisse d'un cran
  const basis = energyBasis(body, profile);
  const days = dailyActivity({ workouts, cardio, profile, bodyFatPct: basis.bodyFatPct }, basis.weightKg);
  const act = activityAverage({ workouts, cardio, profile, bodyFatPct: basis.bodyFatPct }, basis.weightKg);
  const training = days.reduce((s, d) => s + d.training, 0);
  const walking = days.reduce((s, d) => s + d.walking, 0);
  const sessions = days.reduce((s, d) => s + d.sessions, 0);
  const walks = days.filter((d) => d.walking > 0).length;
  const active = [...days].filter((d) => d.training + d.walking > 0).reverse();

  return (
    <div className="card">
      <div className="card-header">
        <h2>Calories dépensées</h2>
        <span className="small muted">14 derniers jours</span>
      </div>
      {active.length === 0 ? (
        <Empty>Aucune séance ni marche ces 14 derniers jours.</Empty>
      ) : (
        <>
          <Legend
            items={[
              { label: `Musculation · ${fmtNum(training, 0)} kcal (${sessions} séance${sessions > 1 ? 's' : ''})`, color: TRAINING },
              { label: `Marche · ${fmtNum(walking, 0)} kcal (${walks} jour${walks > 1 ? 's' : ''})`, color: WALKING },
            ]}
          />
          <div className="chart sm">
            <ResponsiveContainer>
              <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: 'numeric' })} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} interval={0} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<DayTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="training" name="Musculation" stackId="sport" fill={TRAINING} maxBarSize={18} shape={BottomSegment} />
                <Bar dataKey="walking" name="Marche" stackId="sport" fill={WALKING} maxBarSize={18} shape={TopSegment} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="small secondary" style={{ margin: '8px 0 0' }}>
            En moyenne <b>{fmtNum(act.perDay, 0)} kcal par jour</b>
            {act.source === 'plan' ? ' (estimées d’après ton profil, faute d’une semaine d’historique)' : ` sur ${act.days} jour${act.days > 1 ? 's' : ''}`}, ajoutées à ta
            cible de l’onglet Nutrition. Calories au-delà du repos.
          </p>
          <details style={{ marginTop: 8 }}>
            <summary className="small">Détail jour par jour</summary>
            <div className="table-wrap" style={{ marginTop: 6 }}>
              <table>
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th className="num">Musculation</th>
                    <th className="num">Marche</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((d) => (
                    <tr key={d.date}>
                      <td>{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="num">{d.training ? `${fmtNum(d.training, 0)} kcal` : '—'}</td>
                      <td className="num">{d.walking ? `${fmtNum(d.walking, 0)} kcal` : '—'}</td>
                      <td className="num">
                        <b>{fmtNum(d.training + d.walking, 0)} kcal</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: DayActivity;
}

/** Colonne à bout arrondi (4 px) en haut, carrée à la base ; `gap` laisse 2 px de fond au-dessus. */
function column({ x = 0, y = 0, width = 0, height = 0, fill }: SegmentProps, rounded: boolean, gap: number) {
  const h = height - gap;
  if (h <= 0 || width <= 0) return <g />;
  const top = y + gap;
  const r = rounded ? Math.min(4, width / 2, h) : 0;
  const d = r
    ? `M${x},${top + h}V${top + r}a${r},${r} 0 0 1 ${r},${-r}H${x + width - r}a${r},${r} 0 0 1 ${r},${r}V${top + h}Z`
    : `M${x},${top + h}V${top}H${x + width}V${top + h}Z`;
  return <path d={d} fill={fill} />;
}

/** Musculation, en bas de la pile : arrondie seulement s'il n'y a pas de marche au-dessus, sinon 2 px d'écart. */
function BottomSegment(p: SegmentProps) {
  const covered = (p.payload?.walking ?? 0) > 0;
  return column(p, !covered, covered ? Math.min(2, (p.height ?? 0) / 2) : 0);
}

/** Marche, toujours en haut de la pile. */
function TopSegment(p: SegmentProps) {
  return column(p, true, 0);
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayActivity }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const total = d.training + d.walking;
  return (
    <div className="tooltip">
      <div className="t">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      {total === 0 ? (
        <div>Repos : ni séance ni marche</div>
      ) : (
        <>
          <TipRow color={TRAINING} kcal={d.training} label={d.sessions ? `musculation · ${d.sessions > 1 ? `${d.sessions} séances, ` : ''}${d.sessionMinutes} min` : 'musculation'} />
          <TipRow color={WALKING} kcal={d.walking} label={d.walking ? `marche · ${fmtNum(d.distanceKm, 1)} km, ${fmtNum(d.steps, 0)} pas` : 'marche'} />
          {d.training > 0 && d.walking > 0 && (
            <div className="tip-total">
              Total <b>{fmtNum(total, 0)} kcal</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TipRow({ color, kcal, label }: { color: string; kcal: number; label: string }) {
  return (
    <div className="tip-row">
      <i className="tip-key" style={{ background: color }} />
      <b>{fmtNum(kcal, 0)} kcal</b> <span className="muted">{label}</span>
    </div>
  );
}
