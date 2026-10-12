import { useState } from 'react';
import type { PlanTemplate } from '../data/plans';
import { currentComposition, GOAL_LABELS } from '../lib/calc';
import { goalMath, nextMonday, planEnd } from '../lib/plan';
import { useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import { EQUIPMENT_LABELS, LEVEL_LABELS } from './ProfileForm';
import Sheet from './Sheet';
import { fmtDate, fmtNum } from './ui';

/**
 * Poids visé proposé : masse maigre actuelle moins 6 % (eau, glycogène et un peu de muscle perdus en sèche longue),
 * ramenée au % de gras visé. Sans % de gras connu : l'objectif déjà saisi, sinon −10 %.
 */
export function suggestedTarget(weightKg: number | undefined, leanKg: number | undefined, bodyFatPct: number, existing?: number): number | undefined {
  if (leanKg !== undefined) return Math.round((leanKg * 0.94) / (1 - bodyFatPct / 100));
  if (existing !== undefined) return existing;
  return weightKg !== undefined ? Math.round(weightKg * 0.9) : undefined;
}

export default function ApplyPlanSheet({ tpl, onClose, onApplied }: { tpl: PlanTemplate; onClose: () => void; onApplied?: () => void }) {
  const { profile, body, applyPlan } = useStore();
  const today = useToday();
  const comp = currentComposition(body, profile);
  const bfDefault = profile.targetBodyFatPct ?? tpl.defaultBodyFatPct[profile.sex];
  const [start, setStart] = useState(profile.plan?.id === tpl.id ? profile.plan.start : nextMonday(today));
  const [bfText, setBfText] = useState(String(bfDefault).replace('.', ','));
  const [kgText, setKgText] = useState(() => {
    const s = suggestedTarget(comp?.weightKg, comp?.leanKg, bfDefault, profile.targetWeightKg);
    return s !== undefined ? String(s).replace('.', ',') : '';
  });
  const [err, setErr] = useState('');
  const num = (t: string) => Number(t.replace(',', '.'));
  const kg = num(kgText);
  const bf = num(bfText);
  const valid = Number.isFinite(kg) && kg >= 30 && kg <= 300 && Number.isFinite(bf) && bf >= 3 && bf <= 60 && /^\d{4}-\d{2}-\d{2}$/.test(start);
  const gm = valid && comp ? goalMath({ weightKg: comp.weightKg, leanKg: comp.leanKg }, { weightKg: kg, bodyFatPct: bf }, tpl.weeks) : undefined;

  const apply = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return setErr('Choisis une date de départ.');
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) return setErr('Poids visé : entre 30 et 300 kg.');
    if (!Number.isFinite(bf) || bf < 3 || bf > 60) return setErr('Masse grasse visée : entre 3 et 60 %.');
    applyPlan(tpl.id, start, { weightKg: Math.round(kg * 10) / 10, bodyFatPct: Math.round(bf * 10) / 10 });
    onApplied?.();
    onClose();
  };

  return (
    <Sheet title={tpl.name} kicker="Appliquer à mon profil" onClose={onClose}>
      <p className="small secondary" style={{ marginTop: 0 }}>
        {tpl.summary}
      </p>
      <div className="form-grid">
        <label className="field">
          Départ (un lundi de préférence)
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          Poids visé (kg)
          <input inputMode="decimal" value={kgText} onChange={(e) => setKgText(e.target.value)} />
        </label>
        <label className="field">
          Masse grasse visée (%)
          <input inputMode="decimal" value={bfText} onChange={(e) => setBfText(e.target.value)} />
        </label>
      </div>
      {valid && (
        <p className="small secondary">
          Fin du plan le <b>{fmtDate(planEnd(tpl, start), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b> ({tpl.weeks} semaines).
          {gm && gm.toLoseKg > 0 && (
            <>
              {' '}
              {fmtNum(gm.toLoseKg)} kg à perdre : environ <b>{fmtNum(Math.round(gm.deficitPlan / 10) * 10, 0)} kcal de déficit par jour</b>, soit {fmtNum(gm.ratePlan, 2)} kg par semaine.
            </>
          )}
          {gm?.maxLeanLossKg !== undefined && gm.maxLeanLossKg < 0 && (
            <span style={{ color: 'var(--critical)' }}> Avec ces chiffres, il faudrait gagner {fmtNum(-gm.maxLeanLossKg)} kg de masse maigre : vise un poids un peu plus haut.</span>
          )}
        </p>
      )}
      <div className="callout small">
        Ton profil passe en : {GOAL_LABELS[tpl.profile.goal].toLowerCase()}, {tpl.profile.daysPerWeek} séances de {tpl.profile.sessionMinutes} min, niveau{' '}
        {LEVEL_LABELS[tpl.profile.level].toLowerCase()}, {EQUIPMENT_LABELS[tpl.profile.equipment].toLowerCase()}. Le programme de la phase en cours devient ton programme actif et change tout
        seul à chaque nouvelle phase. Tes séances et mesures ne sont pas touchées.
      </div>
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={apply}>
          Appliquer à mon profil
        </button>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Sheet>
  );
}
