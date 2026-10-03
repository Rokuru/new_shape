import { useState } from 'react';
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
  const [err, setErr] = useState('');
  const target = profile.targetWeightKg;

  if (!comp) return null;
  const current = comp.weightKg;

  const save = () => {
    const n = Number(text.replace(',', '.'));
    if (!Number.isFinite(n) || n < 30 || n > 300) return setErr('Entre 30 et 300 kg.');
    if (Math.abs(n - current) < 0.5) return setErr('C’est déjà ton poids actuel.');
    setProfile({ targetWeightKg: Math.round(n * 10) / 10, targetStartKg: Math.round(current * 10) / 10, targetSetAt: today });
    setEditing(false);
    setErr('');
  };

  const form = (
    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
      <label className="field" style={{ flex: '1 1 160px' }}>
        Poids visé (kg)
        <input inputMode="decimal" value={text} autoFocus placeholder={fmtNum(Math.round(current - 10))} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-invalid={!!err} />
        {err && <span className="field-error">{err}</span>}
      </label>
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
        {target === undefined && <p className="small secondary" style={{ marginTop: 0 }}>Fixe un poids cible : l’appli estime ta date d’arrivée d’après ta tendance réelle et découpe le chemin en paliers de 5 kg.</p>}
        {form}
      </div>
    );
  }

  const p = goalProjection({ currentKg: current, targetKg: target, startKg: profile.targetStartKg ?? current, ratePerWeek: rate, today });
  const losing = target < (profile.targetStartKg ?? current);

  return (
    <div className="card goal-card">
      <div className="card-header">
        <h2>Mon objectif</h2>
        <button
          className="btn ghost sm"
          onClick={() => {
            setText(String(target).replace('.', ','));
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
            {p.status === 'reached' ? `objectif de ${fmtNum(target)} kg` : `restants pour atteindre ${fmtNum(target)} kg`} · actuel {fmtNum(current)} kg
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
        <span>départ {fmtNum(profile.targetStartKg ?? current)} kg{profile.targetSetAt ? ` (${fmtDate(profile.targetSetAt)})` : ''}</span>
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
