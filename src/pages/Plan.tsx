import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Tab } from '../App';
import ApplyPlanSheet, { suggestedTarget } from '../components/ApplyPlanSheet';
import { ExerciseLink } from '../components/ExerciseInfo';
import { ChartTooltip, fmtDate, fmtNum, Icon, Legend, Rich } from '../components/ui';
import { PLAN_TEMPLATES, type PlanPhase, type PlanTable } from '../data/plans';
import { useToday } from '../hooks/useToday';
import { cardioStats, isValidCardio } from '../lib/cardio';
import { BMR_FORMULAS, currentComposition, nutritionTargets, weightTrend } from '../lib/calc';
import { addDays, daysBetween } from '../lib/dates';
import { activityAverage } from '../lib/energy';
import { checkpoints, expectedWeight, goalMath, holidayWeeks, nextMonday, phaseDates, planEnd, planEnergy, planProgramId, planStatus, planTemplate, trackingRows } from '../lib/plan';
import { useStore } from '../lib/store';
import { dayToTime, timeAxis } from '../lib/timeAxis';
import type { LoggedSet } from '../lib/types';

const r10 = (n: number) => Math.round(n / 10) * 10;
const r50 = (n: number) => Math.round(n / 50) * 50;
const longDate = (d: string) => fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' });
const setText = (s?: LoggedSet) => (s ? `${fmtNum(s.weight, 2)} × ${s.reps}` : '—');
const reps = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
const rest = (sec: number) => (sec === 0 ? 'enchaîner' : sec < 60 ? `${sec} s` : sec % 60 ? `${fmtNum(sec / 60, 1)} min` : `${sec / 60} min`);

function Table({ table, highlight }: { table: PlanTable; highlight?: number }) {
  return (
    <div className="table-wrap">
      <table className="plan-table">
        <thead>
          <tr>
            {table.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className={i === highlight ? 'current' : undefined}>
              {row.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="plan-list">
      {items.map((b, i) => (
        <li key={i}>
          <Rich text={b} />
        </li>
      ))}
    </ul>
  );
}

export default function PlanPage({ go }: { go: (t: Tab) => void }) {
  const { profile, body, workouts, cardio, kcalAdjust, activeProgramId, removePlan } = useStore();
  const today = useToday();
  const [applying, setApplying] = useState(false);
  const st = planStatus(profile, today);
  const tpl = st?.tpl ?? planTemplate(profile.plan?.id) ?? PLAN_TEMPLATES[0];
  const applied = Boolean(st);
  const start = st?.start ?? nextMonday(today);
  const end = planEnd(tpl, start);

  const comp = currentComposition(body, profile);
  const targetBf = profile.targetBodyFatPct ?? tpl.defaultBodyFatPct[profile.sex];
  const targetKg = applied ? profile.targetWeightKg : suggestedTarget(comp?.weightKg, comp?.leanKg, targetBf, profile.targetWeightKg);
  const gm = comp && targetKg !== undefined ? goalMath({ weightKg: comp.weightKg, leanKg: comp.leanKg }, { weightKg: targetKg, bodyFatPct: targetBf }, tpl.weeks) : undefined;
  const energy = comp && gm ? planEnergy(profile, comp.weightKg, comp.bodyFatPct, comp.leanKg, gm.deficitPlan) : undefined;
  const latest = body.at(-1);
  const act = comp ? activityAverage({ workouts, cardio, profile, bodyFatPct: comp.bodyFatPct }, comp.weightKg) : undefined;
  const nut = latest && comp && act ? nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust, act.perDay) : undefined;

  // Trajectoire : ligne droite du poids de départ à l'objectif, comparée à la tendance réelle.
  const startKg = profile.targetStartKg ?? comp?.weightKg;
  const trend = weightTrend(body).filter((d) => d.date >= addDays(start, -14) && d.date <= today);
  const chartData =
    applied && startKg !== undefined && targetKg !== undefined
      ? [
          { date: start, t: dayToTime(start), prevu: startKg },
          ...trend.map((d) => ({ date: d.date, t: dayToTime(d.date), reel: d.trend })),
          { date: end, t: dayToTime(end), prevu: targetKg },
        ].sort((a, b) => a.t - b.t)
      : [];
  const axis = chartData.length >= 2 ? timeAxis(chartData.map((d) => d.t)) : undefined;
  // Graduations rondes (tous les 5 ou 10 kg) plutôt que des valeurs calculées au hasard du domaine.
  const kgs = chartData.flatMap((d) => [('prevu' in d ? d.prevu : undefined), ('reel' in d ? d.reel : undefined)]).filter((v): v is number => v !== undefined);
  const step = kgs.length && Math.max(...kgs) - Math.min(...kgs) > 25 ? 10 : 5;
  const yMin = kgs.length ? Math.floor((Math.min(...kgs) - 1) / step) * step : 0;
  const yMax = kgs.length ? Math.ceil((Math.max(...kgs) + 1) / step) * step : 0;
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  const expectedNow = applied && startKg !== undefined && targetKg !== undefined ? expectedWeight(start, end, startKg, targetKg, today) : undefined;
  const gap = expectedNow !== undefined && comp && st?.started ? comp.weightKg - expectedNow : undefined;

  const rows = applied && startKg !== undefined && targetKg !== undefined ? trackingRows(tpl, start, { profile, body, workouts, startKg, targetKg }, today) : [];
  const nextCheck = rows.find((r) => r.future)?.date;
  const recentWalks = cardio.filter((c) => isValidCardio(c) && c.speedKmh && c.durationMin && daysBetween(c.date, today) < 14 && c.date <= today);
  const walkKg = comp?.weightKg ?? latest?.weightKg ?? 75;
  const fast = cardioStats({ id: 'x', date: today, speedKmh: 5, durationMin: 40, inclinePct: 8 }, profile, walkKg);
  const avg = (f: (c: (typeof recentWalks)[number]) => number) => recentWalks.reduce((s, c) => s + f(c), 0) / recentWalks.length;
  const current = recentWalks.length
    ? { speed: avg((c) => c.speedKmh ?? 0), incline: avg((c) => c.inclinePct), minutes: avg((c) => c.durationMin ?? 0), kcal: avg((c) => cardioStats(c, profile, walkKg).kcal) }
    : undefined;
  const holidays = holidayWeeks(tpl, start);
  const dayOfMonth = Number(start.slice(8, 10));

  return (
    <div>
      <div className="sheet-kicker">{applied ? 'Mon plan objectif' : 'Plan objectif'}</div>
      <h1>{tpl.name}</h1>

      <div className="card">
        {targetKg !== undefined && (
          <p style={{ marginTop: 0 }}>
            <b>
              Objectif : {fmtNum(targetKg)} kg et moins de {fmtNum(targetBf)} % de masse grasse vers {fmtDate(end, { month: 'long', year: 'numeric' })} ({tpl.weeks} semaines).
            </b>
            {gm && gm.toLoseKg > 0 && <> En 6 mois, c’est possible, mais il faudrait tenir environ {fmtNum(r10(gm.deficit6m), 0)} kcal de déficit par jour.</>}
          </p>
        )}
        <p className="small secondary">
          Du {longDate(start)} au {longDate(end)}.
        </p>
        {applied && st ? (
          <div className="plan-status">
            <b>{st.finished ? 'Plan terminé : fais le bilan (mesures, photos, test des charges clés).' : st.started ? `Semaine ${st.week}/${tpl.weeks} · Phase ${st.phaseIndex + 1} – ${st.phase.name}` : `Départ le ${longDate(start)}`}</b>
            {gap !== undefined && (
              <div className="small secondary">
                Tendance {fmtNum(comp!.weightKg)} kg pour {fmtNum(expectedNow!)} kg prévus aujourd’hui :{' '}
                {Math.abs(gap) < 0.5 ? 'dans les clous.' : gap < 0 ? `${fmtNum(-gap)} kg d’avance.` : `${fmtNum(gap)} kg de retard.`}
              </div>
            )}
            {activeProgramId !== planProgramId(tpl, st.phase) && !st.finished && (
              <div className="small" style={{ color: 'var(--critical)' }}>
                Ton programme actif n’est pas celui du plan : active-le depuis ton profil ou l’onglet Programmes.
              </div>
            )}
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => setApplying(true)}>
              Appliquer à mon profil
            </button>
          </div>
        )}
      </div>

      {axis && (
        <div className="card">
          <div className="card-header">
            <h2>Trajectoire</h2>
          </div>
          <Legend
            items={[
              { label: 'Prévu (ligne droite jusqu’à l’objectif)', color: 'var(--series-1)', dashed: true },
              { label: 'Ton poids (tendance)', color: 'var(--series-2)' },
            ]}
          />
          <div className="chart sm">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" type="number" domain={axis.domain} ticks={axis.ticks} tickFormatter={axis.format} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={16} />
                <YAxis domain={[yMin, yMax]} ticks={yTicks} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v, 0)} />
                <Tooltip content={<ChartTooltip unit=" kg" />} />
                <Line dataKey="prevu" name="Prévu" stroke="var(--series-1)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
                <Line dataKey="reel" name="Tendance" stroke="var(--series-2)" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Profil et objectifs</h2>
        {comp && targetKg !== undefined ? (
          <div className="table-wrap">
            <table className="plan-table">
              <thead>
                <tr>
                  <th />
                  <th>Aujourd’hui</th>
                  <th>Cible</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Poids</th>
                  <td>{fmtNum(comp.weightKg)} kg</td>
                  <td>{fmtNum(targetKg)} kg</td>
                </tr>
                <tr>
                  <th scope="row">Masse grasse</th>
                  <td>{comp.bodyFatPct !== undefined ? `${fmtNum(comp.bodyFatPct)} % ≈ ${fmtNum(comp.fatKg ?? 0, 0)} kg` : '—'}</td>
                  <td>
                    &lt; {fmtNum(targetBf)} % ≈ &lt; {fmtNum(gm!.targetFatKg)} kg
                  </td>
                </tr>
                <tr>
                  <th scope="row">Masse maigre</th>
                  <td>{comp.leanKg !== undefined ? `≈ ${fmtNum(comp.leanKg, 0)} kg` : '—'}</td>
                  <td>
                    ≥ {fmtNum(gm!.minLeanKg)} kg
                    {comp.leanKg !== undefined && comp.leanKg - 1 > gm!.minLeanKg && ` (idéal ${fmtNum(Math.max(gm!.minLeanKg, comp.leanKg - 3), 0)}–${fmtNum(comp.leanKg - 1, 0)} kg)`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">Ajoute une pesée (et ton % de gras) dans l’onglet Corps pour calculer ton objectif.</p>
        )}
        <ul className="plan-list">
          {gm && gm.maxLeanLossKg !== undefined && (
            <li>
              {gm.maxLeanLossKg >= 0 ? (
                <Rich
                  text={`**Le muscle est la contrainte.** À ${fmtNum(targetKg!)} kg, passer sous ${fmtNum(targetBf)} % suppose de garder au moins ${fmtNum(gm.minLeanKg)} kg de masse maigre. Tu peux donc en perdre ${fmtNum(gm.maxLeanLossKg)} kg au maximum, eau et glycogène compris. La musculation lourde sert à ça : garder le muscle pendant que le déficit fait fondre la graisse.`}
                />
              ) : (
                <Rich
                  text={`**Le muscle est la contrainte.** À ${fmtNum(targetKg!)} kg, passer sous ${fmtNum(targetBf)} % suppose ${fmtNum(gm.minLeanKg)} kg de masse maigre, soit ${fmtNum(-gm.maxLeanLossKg)} kg de plus qu’aujourd’hui : difficile en déficit. Vise un poids un peu plus haut, ou accepte un % de gras plus élevé.`}
                />
              )}
            </li>
          )}
          {gm && gm.toLoseKg > 0 && (
            <li>
              <Rich
                text={`**Le rythme.** ${fmtNum(gm.toLoseKg)} kg à perdre ≈ ${fmtNum(Math.round(gm.kcal / 1000) * 1000, 0)} kcal (7 700 kcal/kg). Sur ${tpl.weeks} semaines, ça donne environ ${fmtNum(r10(gm.deficitPlan), 0)} kcal de déficit par jour, soit ${fmtNum(gm.ratePlan, 2)} kg/semaine en moyenne. Sur 6 mois, environ ${fmtNum(r10(gm.deficit6m), 0)} kcal/jour.`}
              />
            </li>
          )}
          <li>
            <Rich text={`**Le cadre retenu.** ${tpl.frame} Départ le ${longDate(start)}.`} />
          </li>
          <li>
            <Rich text={tpl.books} />
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Vue d’ensemble : {tpl.phases.length} phases</h2>
        <p className="small secondary" style={{ marginTop: 0 }}>
          {tpl.overview}
        </p>
        <ol className="plan-phases">
          {tpl.phases.map((p, i) => {
            const d = phaseDates(start, p);
            return (
              <li key={p.id} className={st && st.phase === p && st.started && !st.finished ? 'current' : undefined}>
                <b>
                  Phase {i + 1} – {p.name}
                </b>
                <span className="small muted">
                  S{p.weeks[0]}–S{p.weeks[1]} · {shortDate(d.from)} → {shortDate(d.to)}
                </span>
              </li>
            );
          })}
        </ol>
        <h3>Semaine type</h3>
        <Table table={tpl.weekType} />
      </div>

      {tpl.phases.map((p, i) => (
        <PhaseCard key={p.id} phase={p} index={i} start={start} open={st ? st.phase === p : i === 0} current={!!st && st.phase === p && st.started && !st.finished} holidays={holidays} />
      ))}

      <div className="card">
        <h2>Cardio, marche et dépense quotidienne</h2>
        <p className="small secondary" style={{ marginTop: 0 }}>
          {tpl.cardioIntro} À {fmtNum(walkKg, 1)} kg, 40 min à 5 km/h et 8 % de pente ≈ <b>{fmtNum(fast.kcal, 0)} kcal</b>
          {current && (
            <>
              {' '}
              ; ta marche actuelle ({fmtNum(current.speed)} km/h, {fmtNum(current.incline, 0)} %, ~{fmtNum(current.minutes, 0)} min) ≈ <b>{fmtNum(current.kcal, 0)} kcal</b>
            </>
          )}
          . Estimations (équation de marche de l’ACSM).
        </p>
        <Table
          table={{ head: ['Phase', 'Marche inclinée (tapis)', 'Pas par jour', 'Intervalles'], rows: tpl.phases.map((p, i) => [`${i + 1} (S${p.weeks[0]}–S${p.weeks[1]})`, p.cardio.walk, p.cardio.steps, p.cardio.intervals]) }}
          highlight={st && st.started && !st.finished ? st.phaseIndex : undefined}
        />
        <Bullets items={tpl.cardioBullets} />
      </div>

      <div className="card">
        <h2>Règles : échauffement, progression, sécurité</h2>
        <p className="small secondary" style={{ marginTop: 0 }}>
          {tpl.rulesIntro}
        </p>
        {tpl.rules.map((r) => (
          <details key={r.title} className="plan-details">
            <summary>{r.title}</summary>
            {r.intro && <p className="small secondary">{r.intro}</p>}
            {r.steps && (
              <ol className="plan-list">
                {r.steps.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ol>
            )}
            {r.bullets && <Bullets items={r.bullets} />}
            {r.outro && <p className="small secondary">{r.outro}</p>}
          </details>
        ))}
      </div>

      <div className="card">
        <h2>Machines Basic-Fit et alternatives</h2>
        <p className="small secondary" style={{ marginTop: 0 }}>
          {tpl.machinesIntro}
        </p>
        <Table table={tpl.machines} />
      </div>

      <div className="card">
        <h2>Suivi mensuel et ajustements</h2>
        <p className="small secondary" style={{ marginTop: 0 }}>
          Chaque {dayOfMonth === 1 ? '1er' : dayOfMonth} du mois, compare ta moyenne de poids à la ligne prévue. Si tu es dans les clous et que tes charges tiennent, ne change rien.
        </p>
        <h3>Mesures</h3>
        <Bullets items={tpl.measures} />
        {energy && gm && (
          <>
            <h3>Repères caloriques</h3>
            <Bullets
              items={[
                `**Dépense estimée.** Métabolisme de base ≈ ${fmtNum(r10(energy.bmr), 0)} kcal (${BMR_FORMULAS[energy.method].label}), × 1,4–1,5 avec l’activité, soit ≈ ${fmtNum(r50(energy.tdee[0]), 0)}–${fmtNum(r50(energy.tdee[1]), 0)} kcal/jour.`,
                `**Apport.** Environ ${fmtNum(r50(energy.intake[0]), 0)}–${fmtNum(r50(energy.intake[1]), 0)} kcal/jour pour ${fmtNum(r10(gm.deficitPlan), 0)} kcal de déficit.`,
                ...(energy.protein ? [`**Protéines.** ${fmtNum(r10(energy.protein[0]), 0)}–${fmtNum(r10(energy.protein[1]), 0)} g/jour (≈ 2 g par kg de masse maigre) pour protéger le muscle.`] : []),
                `**Recalcul.** Tous les −5 kg, la dépense baisse d’environ ${fmtNum(r10(energy.per5kg), 0)} kcal/jour : enlève-les de l’apport.`,
                ...(nut ? [`**Dans l’app.** L’onglet Nutrition recalcule ta cible chaque jour d’après ta courbe de poids : aujourd’hui ${fmtNum(nut.calories, 0)} kcal et ${nut.proteinG} g de protéines.`] : []),
              ]}
            />
          </>
        )}
        <h3>Ajustements</h3>
        <Bullets items={tpl.adjustments} />
        {applied && rows.length > 0 && (
          <>
            <h3>Tableau de suivi</h3>
            <p className="small muted" style={{ marginTop: 0 }}>
              Rempli tout seul : moyenne des pesées des 7 derniers jours, mesures à ± 10 jours, meilleure série des 14 derniers jours.
            </p>
            <div className="table-wrap">
              <table className="plan-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Prévu</th>
                    <th className="num">Poids moyen</th>
                    <th className="num">Tour de taille</th>
                    <th className="num">MG</th>
                    {tpl.tracked.map((x) => (
                      <th key={x.id} className="num">
                        {x.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className={r.date === nextCheck ? 'current' : undefined}>
                      <th scope="row">{fmtDate(r.date, { day: 'numeric', month: 'short', year: '2-digit' })}</th>
                      <td className="num">{fmtNum(r.expectedKg)} kg</td>
                      <td className="num">{r.avgKg !== undefined ? `${fmtNum(r.avgKg)} kg` : '—'}</td>
                      <td className="num">{r.waistCm !== undefined ? `${fmtNum(r.waistCm)} cm` : '—'}</td>
                      <td className="num">{r.bodyFatPct !== undefined ? `${fmtNum(r.bodyFatPct)} %` : '—'}</td>
                      {r.lifts.map((l) => (
                        <td key={l.label} className="num">
                          {setText(l.set)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">{checkpoints(tpl, start).length} points de suivi. La ligne surlignée est le prochain.</p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Sources</h2>
        <Bullets items={tpl.sources} />
      </div>

      {applied ? (
        <button
          className="btn danger ghost block"
          onClick={() => {
            if (confirm('Retirer ce plan de ton profil ? Tes séances et mesures restent, seul le suivi du plan s’arrête.')) {
              removePlan();
              go('profile');
            }
          }}
        >
          <Icon name="trash" size={16} /> Retirer le plan de mon profil
        </button>
      ) : (
        <button className="btn primary block" onClick={() => setApplying(true)}>
          Appliquer à mon profil
        </button>
      )}
      {applying && <ApplyPlanSheet tpl={tpl} onClose={() => setApplying(false)} />}
    </div>
  );
}

function PhaseCard({ phase, index, start, open, current, holidays }: { phase: PlanPhase; index: number; start: string; open: boolean; current: boolean; holidays: number[] }) {
  const d = phaseDates(start, phase);
  const festive = holidays.filter((w) => w >= phase.weeks[0] && w <= phase.weeks[1]);
  return (
    <details className={`card plan-phase ${current ? 'current' : ''}`} open={open}>
      <summary>
        <span className="plan-phase-title">
          Phase {index + 1} – {phase.name}
        </span>
        <span className="small muted">
          S{phase.weeks[0]}–S{phase.weeks[1]}, {shortDate(d.from)} → {shortDate(d.to)}
          {current && ' · en cours'}
        </span>
      </summary>
      <p className="small secondary">{phase.summary}</p>
      <Bullets items={phase.bullets} />
      {festive.length > 0 && (
        <p className="small secondary">
          🎄 S{festive.join('–S')} tombe{festive.length > 1 ? 'nt' : ''} pendant les fêtes : si tu sautes une séance, décale-la sans la doubler.
        </p>
      )}
      <p className="small">
        <b>Rythme :</b> {phase.rotation}.
      </p>
      {phase.days.map((day) => (
        <div key={day.name} className="plan-session">
          <h3>{day.name}</h3>
          <div className="table-wrap">
            <table className="plan-table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Exercice</th>
                  <th>Séries × reps</th>
                  <th>Repos</th>
                  <th>Point clé</th>
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((e, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <td style={{ minWidth: 150 }}>
                      <ExerciseLink id={e.exerciseId} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {e.sets} × {reps(e.repMin, e.repMax)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{rest(e.restSec)}</td>
                    <td className="small secondary" style={{ minWidth: 180 }}>
                      {e.note ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {day.note && <p className="small secondary">👉 {day.note}</p>}
        </div>
      ))}
    </details>
  );
}
