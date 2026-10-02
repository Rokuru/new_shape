import type { ChangeEvent } from 'react';
import { MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../lib/calc';
import type { ActivityLevel, Equipment, Goal, Level, Profile } from '../lib/types';

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
          <input type="number" inputMode="numeric" value={profile.birthYear} onChange={num('birthYear')} />
        </label>
        <label className="field">
          Taille (cm)
          <input type="number" inputMode="numeric" value={profile.heightCm} onChange={num('heightCm')} />
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
