import { useEffect, useState, type ChangeEvent } from 'react';
import { PROFILE_LIMITS } from '../lib/store';
import { MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../lib/calc';
import { splitFor, SPLITS } from '../lib/generator';
import type { ActivityLevel, Equipment, Goal, Level, Profile, SplitPref } from '../lib/types';

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Débutant (< 1 an)',
  intermediate: 'Intermédiaire (1–3 ans)',
  advanced: 'Avancé (3 ans +)',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  full_gym: 'Salle de sport complète',
  home_dumbbells: 'Maison : haltères + banc',
  bodyweight: 'Poids du corps (barre de traction)',
};

export default function ProfileForm({ profile, onChange }: { profile: Profile; onChange: (p: Partial<Profile>) => void }) {
  const num = (k: keyof Profile) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ [k]: Number(e.target.value) } as Partial<Profile>);
  return (
    <div className="stack">
      <div className="form-grid">
        <label className="field">
          Prénom
          <input value={profile.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Optionnel" />
        </label>
        <label className="field">
          Sexe
          <select value={profile.sex} onChange={(e) => onChange({ sex: e.target.value as Profile['sex'] })}>
            <option value="male">Homme</option>
            <option value="female">Femme</option>
          </select>
        </label>
        <label className="field">
          Année de naissance
          <BoundedNumber value={profile.birthYear} {...PROFILE_LIMITS.birthYear} onValid={(v) => onChange({ birthYear: v })} />
        </label>
        <label className="field">
          Taille (cm)
          <BoundedNumber value={profile.heightCm} {...PROFILE_LIMITS.heightCm} onValid={(v) => onChange({ heightCm: v })} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          Objectif
          <select value={profile.goal} onChange={(e) => onChange({ goal: e.target.value as Goal })}>
            {Object.entries(GOAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Niveau
          <select value={profile.level} onChange={(e) => onChange({ level: e.target.value as Level })}>
            {Object.entries(LEVEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Activité quotidienne (hors sport)
          <select value={profile.activity} onChange={(e) => onChange({ activity: e.target.value as ActivityLevel })}>
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Matériel
          <select value={profile.equipment} onChange={(e) => onChange({ equipment: e.target.value as Equipment })}>
            {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Séances / semaine
          <select value={profile.daysPerWeek} onChange={num('daysPerWeek')}>
            {[2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Durée d’une séance
          <select value={profile.sessionMinutes} onChange={num('sessionMinutes')}>
            {[15, 30, 45, 60, 75, 90].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <SplitPicker profile={profile} onChange={onChange} />
      <div>
        <div className="small secondary" style={{ marginBottom: 6 }}>
          Muscles à prioriser (volume supplémentaire)
        </div>
        <div className="chips">
          {MUSCLES.map((m) => {
            const on = profile.priorities.includes(m);
            return (
              <button
                type="button"
                key={m}
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => onChange({ priorities: on ? profile.priorities.filter((p) => p !== m) : [...profile.priorities, m] })}
              >
                {MUSCLE_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Type de programme généré (full body, haut/bas, PPL…) et préférence pour les machines. */
export function SplitPicker({ profile, onChange }: { profile: Profile; onChange: (p: Partial<Profile>) => void }) {
  const pref = profile.split ?? 'auto';
  const plan = splitFor(profile.daysPerWeek, pref);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="field">
        Type de programme
        <select value={pref} onChange={(e) => onChange({ split: e.target.value as SplitPref })}>
          {(Object.keys(SPLITS) as SplitPref[]).map((k) => (
            <option key={k} value={k}>
              {SPLITS[k].label}
              {k !== 'auto' && (profile.daysPerWeek < SPLITS[k].min ? ` (${SPLITS[k].min} séances min.)` : '')}
            </option>
          ))}
        </select>
      </label>
      <div className="small secondary">
        {SPLITS[pref].hint} Avec {profile.daysPerWeek} séances : <b>{plan.label}</b>.{plan.note && <span className="muted"> {plan.note}</span>}
      </div>
      {profile.equipment === 'full_gym' && (
        <label className="small" style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={profile.preferMachines === true}
            onChange={(e) => onChange({ preferMachines: e.target.checked })}
            style={{ width: 20, height: 20, minHeight: 0, flexShrink: 0 }}
          />
          <span>Machines de préférence (Basic-Fit) : presse pectoraux, tirage, presse à cuisses… plutôt que barres et haltères</span>
        </label>
      )}
    </div>
  );
}

/** Champ numérique libre pendant la frappe ; la valeur n'est enregistrée que si elle est plausible. */
function BoundedNumber({ value, min, max, onValid }: { value: number; min: number; max: number; onValid: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
  return (
    <>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        aria-invalid={!valid}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min && v <= max) onValid(Math.round(v));
        }}
        onBlur={() => !valid && setText(String(value))}
      />
      {!valid && <span className="field-error">Entre {min} et {max}</span>}
    </>
  );
}
