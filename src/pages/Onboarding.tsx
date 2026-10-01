import { useState } from 'react';
import ProfileForm from '../components/ProfileForm';
import { generateProgram } from '../lib/generator';
import { today, uid, useStore } from '../lib/store';

export default function Onboarding() {
  const { profile, setProfile, upsertBody, saveCustomProgram, activateProgram, completeOnboarding, importData } = useStore();
  const [weight, setWeight] = useState('');
  const [bf, setBf] = useState('');
  const [err, setErr] = useState('');

  const start = () => {
    const w = Number(weight.replace(',', '.'));
    if (!w || w < 30 || w > 300) {
      setErr('Indique ton poids actuel (en kg) pour calculer tes besoins.');
      return;
    }
    const b = Number(bf.replace(',', '.'));
    upsertBody({ id: uid(), date: today(), weightKg: w, bodyFatPct: b > 2 && b < 70 ? b : undefined });
    const program = generateProgram(profile);
    saveCustomProgram(program);
    activateProgram(program.id);
    completeOnboarding();
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      importData(JSON.parse(await file.text()));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="app" style={{ paddingBottom: 32 }}>
      <div className="brand" style={{ marginBottom: 16 }}>
        New<span>Shape</span>
      </div>
      <h1>Construisons ton plan</h1>
      <p className="secondary">
        Quelques infos pour générer un programme adapté (split, volume, exercices), calculer tes besoins nutritionnels et suivre ta composition
        corporelle. Tout reste stocké sur ton appareil.
      </p>
      <div className="card">
        <h2>Profil</h2>
        <ProfileForm profile={profile} onChange={setProfile} />
      </div>
      <div className="card">
        <h2>Point de départ</h2>
        <div className="form-grid">
          <label className="field">
            Poids actuel (kg) *
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex. 78,5" />
          </label>
          <label className="field">
            % de masse grasse (si connu)
            <input inputMode="decimal" value={bf} onChange={(e) => setBf(e.target.value)} placeholder="ex. 18" />
          </label>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Pas de % de masse grasse ? Tu pourras l’estimer dans l’onglet Corps avec tes tours de taille et de cou (méthode US Navy).
        </p>
      </div>
      {err && <div className="callout" style={{ borderColor: 'var(--critical)' }}>{err}</div>}
      <button className="btn primary block" onClick={start}>
        Générer mon programme
      </button>
      <label className="btn ghost block" style={{ marginTop: 8 }}>
        Restaurer une sauvegarde (.json)
        <input type="file" accept="application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </label>
    </div>
  );
}
