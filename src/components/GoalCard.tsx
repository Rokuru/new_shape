import { useEffect, useState } from 'react';
import { currentComposition, weeklyRate } from '../lib/calc';
import { goalProjection } from '../lib/goal';
import { useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import { fmtDate, fmtNum, Icon, signed } from './ui';

const fmtEta = (d: string) => fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' });

/** Poids objectif : avancement, date d'arrivée estimée au rythme réel et paliers de 5 kg. */
export default function GoalCard() {
  const { profile, body, setProfile } = useStore();
  const today = useToday();
  const comp = currentComposition(body, profile);
  const rate = weeklyRate(body);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [startText, setStartText] = useState('');
  const [err, setErr] = useState('');
  const target = profile.targetWeightKg;
  const sorted = [...body].sort((a, b) => a.date.localeCompare(b.date));
  const lastWeighing = sorted.at(-1);

  // Réparation : un objectif fixé avec l'ancien calcul de tendance a pu prendre un départ faux
  // (pesées d'il y a des années mélangées à celle du jour). On reprend la pesée réelle de ce jour-là.
  const setAt = profile.targetSetAt;
  const weighingAtSet = setAt ? [...sorted].reverse().find((e) => e.date <= setAt) : undefined;
  const badStart = target !== undefined && profile.targetStartKg !== undefined && weighingAtSet && Math.abs(profile.targetStartKg - weighingAtSet.weightKg) > 3;
  useEffect(() => {
    if (badStart && weighingAtSet) setProfile({ targetStartKg: weighingAtSet.weightKg });
  }, [badStart, weighingAtSet, setProfile]);

  if (!comp || !lastWeighing) return null;
  const current = comp.weightKg;

  const parse = (t: string) => Number(t.replace(',', '.'));
  const save = () => {
    const n = parse(text);
    const start = startText.trim() ? parse(startText) : lastWeighing.weightKg;
    if (!Number.isFinite(start) || start < 30 || start > 350) return setErr('Poids de départ : entre 30 et 350 kg.');
    if (!Number.isFinite(n) || n < 30 || n > 300) return setErr('Poids visé : entre 30 et 300 kg.');
    if (Math.abs(n - start) < 0.5) return setErr('Le poids visé est égal au poids de départ.');
    setProfile({ targetWeightKg: Math.round(n * 10) / 10, targetStartKg: Math.round(start * 10) / 10, targetSetAt: target === undefined ? today : (profile.targetSetAt ?? today) });
    setEditing(false);
    setErr('');
  };

  const form = (
    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
      <label className="field" style={{ flex: '1 1 160px' }}>
        Poids de départ (kg)
        <input inputMode="decimal" value={startText} onChange={(e) => setStartText(e.target.value)} placeholder={fmtNum(lastWeighing.weightKg)} />
        <span className="small muted">par défaut : ta dernière pesée ({fmtDate(lastWeighing.date)})</span>
      </label>
      <label className="field" style={{ flex: '1 1 160px' }}>
        Poids visé (kg)
        <input inputMode="decimal" value={text} autoFocus placeholder={fmtNum(Math.round(lastWeighing.weightKg - 10))} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-invalid={!!err} />
      </label>
      {err && <span className="field-error" style={{ flexBasis: '100%' }}>{err}</span>}
      <div className="row" style={{ gap: 8, alignSelf: 'flex-end' }}>
        <button className="btn primary" onClick={save}>
          Valider
        </button>
        {target !== undefined && (
          <button className="btn ghost" onClick={() => setEditing(false)}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );

  if (target === undefined || editing) {
    return (
      <div className="card">
        <h2>Mon objectif</h2>
        {target === undefined && (
          <p className="small secondary" style={{ marginTop: 0 }}>
            Fixe un poids cible : l’appli estime ta date d’arrivée d’après ta tendance réelle et découpe le chemin en paliers de 5 kg. Le restant est calculé sur ton poids lissé, moins sensible
            aux variations d’eau qu’une pesée isolée.
          </p>
        )}
        {form}
      </div>
    );
  }

  const startKg = badStart && weighingAtSet ? weighingAtSet.weightKg : (profile.targetStartKg ?? lastWeighing.weightKg);
  const p = goalProjection({ currentKg: current, targetKg: target, startKg, ratePerWeek: rate, today });
  const losing = target < startKg;

  return (
    <div className="card goal-card">
      <div className="card-header">
        <h2>Mon objectif</h2>
        <button
          className="btn ghost sm"
          onClick={() => {
            setText(String(target).replace('.', ','));
            setStartText(String(profile.targetStartKg ?? lastWeighing.weightKg).replace('.', ','));
            setEditing(true);
          }}
        >
          <Icon name="edit" size={16} /> Modifier
        </button>
      </div>

      <div className="goal-head">
        <div>
          <div className="goal-big">{p.status === 'reached' ? 'Atteint 🎉' : `${fmtNum(p.remainingKg)} kg`}</div>
          <div className="small secondary">
            {p.status === 'reached' ? `objectif de ${fmtNum(target)} kg` : `restants pour atteindre ${fmtNum(target)} kg`}
          </div>
          <div className="small muted">
            poids lissé {fmtNum(current)} kg · dernière pesée {fmtNum(lastWeighing.weightKg)} kg
          </div>
        </div>
        <div className="goal-eta">
          {p.status === 'on_track' && p.eta && (
            <>
              <div className="small muted">Arrivée estimée</div>
              <b>{fmtEta(p.eta)}</b>
              <div className="small muted">
                dans ≈ {p.weeks! < 9 ? `${fmtNum(p.weeks, 0)} sem.` : `${fmtNum(p.weeks! / 4.35, 0)} mois`} à {signed(rate!, 2)} kg/sem.
              </div>
            </>
          )}
          {p.status === 'unknown' && <div className="small secondary">Pèse-toi au moins 3 fois sur 1 semaine pour estimer la date d’arrivée.</div>}
          {p.status === 'flat' && <div className="small secondary">Tendance stable ({signed(rate ?? 0, 2)} kg/sem.) : pas de date estimable à ce rythme.</div>}
          {p.status === 'wrong_way' && (
            <div className="small" style={{ color: 'var(--critical)', fontWeight: 600 }}>
              La tendance va dans l’autre sens ({signed(rate!, 2)} kg/sem.). {losing ? 'Vérifie tes calories dans l’onglet Nutrition.' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="goal-bar" role="progressbar" aria-valuenow={p.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement vers l’objectif">
        <span style={{ width: `${p.progressPct}%` }} />
      </div>
      <div className="spread small muted" style={{ marginTop: 4 }}>
        <span>départ {fmtNum(startKg)} kg{profile.targetSetAt ? ` (${fmtDate(profile.targetSetAt)})` : ''}</span>
        <span>{p.progressPct} %</span>
      </div>

      {p.tooFast && <div className="callout" style={{ marginTop: 12 }}>⚠️ Rythme supérieur à 1 % de ton poids par semaine : au-delà, la perte de muscle augmente. Vise plutôt 0,5 à 1 %/sem.</div>}

      <ol className="milestones">
        {p.milestones.map((m) => (
          <li key={m.kg} className={m.reached ? 'done' : ''}>
            <span className="ms-dot">{m.reached ? <Icon name="check" size={12} /> : null}</span>
            <b>{fmtNum(m.kg)} kg</b>
            <span className="small muted">{m.reached ? 'atteint' : m.eta ? `≈ ${fmtDate(m.eta, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
