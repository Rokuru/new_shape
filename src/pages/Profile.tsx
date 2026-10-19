import { useEffect, useState } from 'react';
import type { Tab } from '../App';
import AccountCard from '../components/AccountCard';
import PlanCard from '../components/PlanCard';
import ProfileForm from '../components/ProfileForm';
import { logout, useAuth } from '../lib/sync';
import { exportData, today, useStore } from '../lib/store';
import { Segmented } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';

type Theme = 'auto' | 'light' | 'dark';

export function readTheme(): Theme {
  try {
    return (localStorage.getItem('new-shape-theme') as Theme) || 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

export default function ProfilePage({ go }: { go: (t: Tab) => void }) {
  const { profile, setProfile, importData, reset } = useStore();
  const ask = useConfirm();
  const connected = useAuth((s) => Boolean(s.user));
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem('new-shape-theme', theme);
    } catch {
      /* stockage indisponible */
    }
  }, [theme]);

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `new-shape-${today()}.json`;
    a.click();
    // Safari iOS lit le fichier après le clic : libérer l'URL tout de suite peut annuler le téléchargement.
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      const ok = await ask({
        title: 'Remplacer tes données par ce fichier ?',
        message: `Tes séances, mesures, repas et réglages actuels sont remplacés par ceux de « ${file.name} ». Exporte-les d’abord si tu veux les garder.`,
        confirmLabel: 'Importer et remplacer',
      });
      if (!ok) return;
      importData(data);
      setMsg('Données restaurées ✓');
    } catch (e) {
      setMsg(`Erreur : ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h1>Profil</h1>
      <AccountCard />
      <PlanCard go={go} />
      <div className="card">
        <ProfileForm profile={profile} onChange={setProfile} />
        <p className="small muted" style={{ marginTop: 12 }}>
          Après un changement (objectif, jours, matériel…), régénère ton programme dans l’onglet{' '}
          <a href="#programs" onClick={() => go('programs')}>
            Programmes
          </a>
          .
        </p>
      </div>

      <div className="card">
        <h2>Apparence</h2>
        <Segmented
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
      </div>

      <div className="card">
        <h2>Données</h2>
        <p className="small secondary">{connected ? 'Tes données sont synchronisées avec ton compte. Tu peux aussi les exporter en fichier.' : 'Sans compte, tes données restent uniquement dans ce navigateur : exporte-les régulièrement ou connecte-toi ci-dessus.'}</p>
        <div className="row">
          <button className="btn" onClick={download}>
            Exporter (.json)
          </button>
          <label className="btn">
            Importer
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                // Le même fichier doit pouvoir être rechoisi après un « Annuler ».
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="btn danger ghost"
            onClick={async () => {
              if (connected) {
                // Effacer en étant connecté viderait aussi le compte : on se déconnecte d'abord.
                if (await ask({ title: 'Effacer les données de cet appareil ?', message: 'Tu seras déconnecté. Elles restent sauvegardées sur ton compte.', confirmLabel: 'Effacer et se déconnecter' })) void logout(true);
              } else if (await ask({ title: 'Effacer toutes les données ?', message: 'Séances, mesures, repas et réglages : cette action est irréversible.', confirmLabel: 'Tout effacer' })) reset();
            }}
          >
            Tout effacer
          </button>
        </div>
        {msg && <p className="small secondary" style={{ marginTop: 8 }}>{msg}</p>}
      </div>

      <div className="card">
        <h2>Sources et méthodes</h2>
        <ul className="small secondary" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Volume : Schoenfeld, Ogborn & Krieger (2017) – relation dose-réponse ; repères MEV/MAV/MRV de Mike Israetel (Renaissance Periodization).</li>
          <li>Fréquence : Schoenfeld et al. (2016) – 2×/semaine par muscle supérieur à 1×.</li>
          <li>Intensité : échelle RIR (Zourdos, Helms et al., 2016).</li>
          <li>Protéines : Morton et al. (2018), Helms et al. (2014) en déficit.</li>
          <li>Métabolisme : Mifflin-St Jeor (1990), Katch-McArdle ; masse grasse : méthode US Navy (Hodgdon & Beckett, 1984).</li>
          <li>1RM : formule d’Epley. FFMI : Kouri et al. (1995).</li>
          <li>Programmes inspirés de : StrongLifts / Starting Strength, GZCLP, 5/3/1 (Wendler), PHUL, PPL r/Fitness, Jeff Nippard, Athlean-X.</li>
        </ul>
        <p className="small muted" style={{ marginTop: 8 }}>Ces outils donnent des estimations. Consulte un professionnel de santé en cas de pathologie ou de douleur.</p>
      </div>
    </div>
  );
}
