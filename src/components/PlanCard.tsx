import { useState } from 'react';
import type { Tab } from '../App';
import { PLAN_TEMPLATES } from '../data/plans';
import { useToday } from '../hooks/useToday';
import { daysBetween } from '../lib/dates';
import { planProgramId, planStatus } from '../lib/plan';
import { useStore } from '../lib/store';
import ApplyPlanSheet from './ApplyPlanSheet';
import PlanStartSheet from './PlanStartSheet';
import { fmtDate, fmtNum, Icon } from './ui';

/** Plan objectif : avancement si un plan est suivi, sinon les plans proposés (profil, programmes). */
export default function PlanCard({ go }: { go: (t: Tab) => void }) {
  const { profile, activeProgramId, activateProgram } = useStore();
  const today = useToday();
  const [applying, setApplying] = useState<string>();
  const [editingStart, setEditingStart] = useState(false);
  const st = planStatus(profile, today);

  if (!st) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Plan objectif</h2>
        </div>
        <p className="small secondary" style={{ marginTop: 0 }}>
          Un programme sur plusieurs mois pour atteindre un poids et un % de gras : phases, séances, marche, règles et suivi mensuel. Les chiffres sont calculés à partir de ton profil.
        </p>
        {PLAN_TEMPLATES.map((t) => (
          <div key={t.id} className="plan-offer">
            <div style={{ minWidth: 0 }}>
              <b>{t.name}</b>
              <div className="small muted">{t.summary}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm" onClick={() => go('plan')}>
                Voir le plan
              </button>
              <button className="btn sm primary" onClick={() => setApplying(t.id)}>
                Appliquer à mon profil
              </button>
            </div>
          </div>
        ))}
        {applying && <ApplyPlanSheet tpl={PLAN_TEMPLATES.find((t) => t.id === applying)!} onClose={() => setApplying(undefined)} onApplied={() => go('plan')} />}
      </div>
    );
  }

  const { tpl, phase, phaseIndex, week, started, finished, start, end } = st;
  const want = planProgramId(tpl, phase);
  const following = activeProgramId === want;
  const pct = Math.min(100, Math.max(0, (daysBetween(start, today) / (tpl.weeks * 7)) * 100));
  const inDays = daysBetween(today, start);

  return (
    <div className="card plan-card">
      <div className="card-header">
        <div style={{ minWidth: 0 }}>
          <div className="sheet-kicker">Mon plan objectif</div>
          <h2 style={{ margin: 0 }}>{tpl.name}</h2>
        </div>
      </div>
      <div className="plan-status">
        {finished ? (
          <b>Plan terminé le {fmtDate(end, { day: 'numeric', month: 'long' })} : place au bilan.</b>
        ) : started ? (
          <b>
            Semaine {week}/{tpl.weeks} · Phase {phaseIndex + 1} – {phase.name}
          </b>
        ) : (
          <b>
            Départ {inDays === 1 ? 'demain' : `dans ${inDays} jours`}, le {fmtDate(start, { weekday: 'long', day: 'numeric', month: 'long' })}
          </b>
        )}
        <div className="plan-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Avancement du plan">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="small muted">
          {fmtDate(start, { day: 'numeric', month: 'short', year: 'numeric' })} → {fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}
          {profile.targetWeightKg !== undefined && ` · objectif ${fmtNum(profile.targetWeightKg)} kg`}
          {profile.targetBodyFatPct !== undefined && ` et moins de ${fmtNum(profile.targetBodyFatPct)} % de masse grasse`}
        </div>
        {!finished && (
          <div className="small secondary">
            Cette phase : {phase.days.map((d) => d.name.replace(/^Séance /, '')).join(', ')} · marche inclinée {phase.cardio.walk} · {phase.cardio.steps} pas/jour
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn primary sm" onClick={() => go('plan')}>
          <Icon name="list" size={16} /> Ouvrir mon plan
        </button>
        <button className="btn sm" onClick={() => setEditingStart(true)}>
          <Icon name="calendar" size={16} /> Changer la date de début
        </button>
        {!following && !finished && (
          <button className="btn sm" onClick={() => activateProgram(want)}>
            Suivre le plan (activer la phase {phaseIndex + 1})
          </button>
        )}
      </div>
      {editingStart && <PlanStartSheet onClose={() => setEditingStart(false)} />}
    </div>
  );
}
