import { useMemo, useState } from 'react';
import type { Tab } from '../App';
import { useToday } from '../hooks/useToday';
import { deficitSummary, KCAL_PER_KG, type DeficitSummary } from '../lib/deficit';
import { useStore } from '../lib/store';
import DeficitStartSheet, { firstOfMonth } from './DeficitStartSheet';
import { fmtDate, fmtNum, Icon } from './ui';

const r10 = (n: number) => Math.round(n / 10) * 10;
const r100 = (n: number) => Math.round(n / 100) * 100;
const kcal = (n: number) => `${fmtNum(r10(n), 0)} kcal`;
const dayMonth = (d: string) => firstOfMonth(fmtDate(d, { day: 'numeric', month: 'long' }));
const SOURCE_LABELS = { custom: 'date choisie', plan: 'départ du plan', goal: 'date de ton objectif' } as const;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Calories à perdre et déficit compté (voir lib/deficit) ; undefined sans objectif de perte ni pesée. */
export function useDeficit(): DeficitSummary | undefined {
  const { profile, body, food, workouts, cardio } = useStore();
  const today = useToday();
  return useMemo(() => deficitSummary({ profile, body, food, workouts, cardio }, today), [profile, body, food, workouts, cardio, today]);
}

/**
 * Compteur : calories perdues (déficit cumulé) sur le total à perdre, barre de progression et rythme.
 * `detailed` ajoute le calcul de l'objectif, le détail du dernier jour compté et les jours non comptés.
 */
export function DeficitBlock({ s, detailed }: { s: DeficitSummary; detailed?: boolean }) {
  const { goal, tally } = s;
  const last = tally.days.at(-1);
  const surplus = tally.total < 0;
  const [editingStart, setEditingStart] = useState(false);
  return (
    <>
      <div className="goal-head">
        <div>
          <div className="goal-big">{s.reached ? 'Atteint 🎉' : surplus ? `+${kcal(-tally.total)}` : kcal(tally.total)}</div>
          <div className="small secondary">
            {s.reached ? `objectif de ${fmtNum(r100(goal.kcal), 0)} kcal atteint` : surplus ? 'de surplus depuis le départ' : `perdues sur les ${fmtNum(r100(goal.kcal), 0)} kcal de l’objectif`}
          </div>
          <div className="small muted">
            {s.notStarted ? `le compteur démarre le ${dayMonth(tally.from)}` : `≈ ${fmtNum(Math.max(0, s.fatKg))} kg de gras${detailed ? '' : ` · depuis le ${dayMonth(tally.from)}`}`}
          </div>
        </div>
        <div className="goal-eta">
          {s.eta ? (
            <>
              <div className="small muted">Arrivée à ce rythme</div>
              <b>{fmtDate(s.eta, { day: 'numeric', month: 'long', year: 'numeric' })}</b>
              <div className="small muted">{kcal(s.avgPerDay!)} par jour en moyenne</div>
            </>
          ) : (
            s.neededPerDay !== undefined && (
              <>
                <div className="small muted">Pour finir le {dayMonth(s.planEnd!)}</div>
                <b>{kcal(s.neededPerDay)}</b>
                <div className="small muted">de déficit par jour</div>
              </>
            )
          )}
        </div>
      </div>

      <div className="goal-bar" role="progressbar" aria-valuenow={Math.round(s.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Calories perdues sur l’objectif">
        <span style={{ width: `${s.pct}%` }} />
      </div>
      <div className="spread small muted" style={{ marginTop: 4 }}>
        <span>{fmtNum(s.pct, s.pct < 10 ? 1 : 0)} %</span>
        <span>objectif {fmtNum(r100(goal.kcal), 0)} kcal</span>
      </div>

      {detailed && (
        <div className="deficit-start">
          <span className="small secondary">
            Compté depuis le <b>{firstOfMonth(fmtDate(tally.from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b> ({SOURCE_LABELS[s.source]})
          </span>
          <button className="btn sm" onClick={() => setEditingStart(true)}>
            <Icon name="calendar" size={16} /> Changer
          </button>
        </div>
      )}
      {editingStart && <DeficitStartSheet onClose={() => setEditingStart(false)} />}

      <ul className="goal-check small secondary">
        {detailed && (
          <li>
            {goal.basis === 'fat' ? (
              <>
                Objectif : <b>{fmtNum(goal.toLoseKg)} kg de gras à perdre</b> ({fmtNum(goal.startFatKg)} kg {s.source === 'custom' ? `le ${dayMonth(tally.from)}` : 'au départ'}, à {fmtNum(goal.startKg)} kg et {fmtNum(goal.startBf)} % → {fmtNum(goal.targetFatKg)} kg à{' '}
                {fmtNum(goal.targetKg)} kg et {fmtNum(goal.targetBf)} %) × {fmtNum(KCAL_PER_KG, 0)} kcal ≈ <b>{fmtNum(r100(goal.kcal), 0)} kcal</b>.
              </>
            ) : (
              <>
                Objectif : <b>{fmtNum(goal.toLoseKg)} kg à perdre</b> ({fmtNum(goal.startKg)} → {fmtNum(goal.targetKg)} kg) × {fmtNum(KCAL_PER_KG, 0)} kcal ≈ <b>{fmtNum(r100(goal.kcal), 0)} kcal</b>. Ajoute un %
                de gras visé pour ne compter que le gras.
              </>
            )}
          </li>
        )}
        {s.avgPerDay !== undefined ? (
          <li>
            Moyenne : {kcal(Math.abs(s.avgPerDay))} de {s.avgPerDay < 0 ? 'surplus' : 'déficit'} par jour sur {plural(tally.days.length, 'jour')} compté{tally.days.length > 1 ? 's' : ''}
            {s.neededPerDay !== undefined && (
              <>
                {' '}
                · il en faut {kcal(s.neededPerDay)} par jour pour finir le {fmtDate(s.planEnd!, { day: 'numeric', month: 'long', year: 'numeric' })}
              </>
            )}
            .
          </li>
        ) : (
          !s.notStarted && <li>Aucune journée comptée pour l’instant : note tes repas dans Nutrition, chaque journée compte le lendemain.</li>
        )}
        {tally.eatenToday > 0 && <li>Aujourd’hui : {kcal(tally.eatenToday)} notées, comptées demain une fois la journée finie.</li>}
        {detailed && last && (
          <li>
            Dernier jour compté ({fmtDate(last.date, { weekday: 'long', day: 'numeric', month: 'long' })}) : dépense {kcal(last.burned)} (métabolisme de base {kcal(last.bmr)} ×{' '}
            {fmtNum(last.base / last.bmr, 3)} pour le quotidien{last.sport > 0 ? ` + ${kcal(last.sport)} de sport` : ''}) − {kcal(last.eaten)} mangées ={' '}
            <b>
              {last.deficit >= 0 ? `${kcal(last.deficit)} de déficit` : `${kcal(-last.deficit)} de surplus`}
            </b>
            .
          </li>
        )}
        {detailed && (tally.missing > 0 || tally.partial.length > 0) && (
          <li>
            Non comptés :{' '}
            {[
              tally.missing > 0 && `${plural(tally.missing, 'jour')} sans repas notés`,
              tally.partial.length > 0 && `${plural(tally.partial.length, 'jour')} avec moins de la moitié du métabolisme de base noté (repas oubliés ?)`,
            ]
              .filter(Boolean)
              .join(', ')}
            .
          </li>
        )}
        {detailed && (
          <li className="muted">
            Chaque journée où tu notes tes repas compte : dépense estimée (la maintenance de l’onglet Nutrition, avec ton sport réel du jour) moins ce que tu as mangé. Un repas
            oublié gonfle le déficit ; la balance reste la référence.
          </li>
        )}
      </ul>
    </>
  );
}

/** Carte de l'accueil : le compteur, avec un lien vers le détail (onglet Corps, « Mon objectif »). */
export default function DeficitCard({ go }: { go: (t: Tab) => void }) {
  const s = useDeficit();
  if (!s) return null;
  return (
    <div className="card deficit-card">
      <div className="card-header">
        <h2>Calories à perdre</h2>
        <button className="btn ghost sm" onClick={() => go('body')}>
          Détail <Icon name="chevron" size={16} />
        </button>
      </div>
      <DeficitBlock s={s} />
    </div>
  );
}
