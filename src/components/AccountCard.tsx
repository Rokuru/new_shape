import { useEffect, useState } from 'react';
import { OAUTH_ENABLED, startOAuth } from '../lib/github';
import { login, logout, syncNow, useAuth } from '../lib/sync';
import { Icon } from './ui';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=New%20Shape';

function ago(iso?: string) {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function SyncBadge() {
  const { status, error, lastSyncAt, dirtyAt } = useAuth();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  if (status === 'syncing') return <span className="status warn">Synchronisation…</span>;
  if (status === 'error') return <span className="status bad">⚠ {error}</span>;
  if (dirtyAt) return <span className="status warn">Modifications en attente</span>;
  return (
    <span className="status ok">
      <Icon name="check" size={14} /> Synchronisé {ago(lastSyncAt)}
    </span>
  );
}

/** Connexion GitHub : les données sont sauvegardées dans un gist secret de l'utilisateur. */
export default function AccountCard({ compact }: { compact?: boolean }) {
  const { token, user, error } = useAuth();
  const [showToken, setShowToken] = useState(!OAUTH_ENABLED);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const connect = async () => {
    setBusy(true);
    setMsg('');
    try {
      await login(value);
      setValue('');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (token && user) {
    return (
      <div className="card">
        <div className="spread">
          <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
            <img src={user.avatarUrl} alt="" width={40} height={40} style={{ borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div>
                <b>{user.name || user.login}</b> <span className="small muted">@{user.login}</span>
              </div>
              <SyncBadge />
            </div>
          </div>
        </div>
        <p className="small secondary" style={{ marginTop: 10 }}>
          Tes données sont sauvegardées dans un gist secret de ton compte GitHub et synchronisées sur tous les appareils où tu te connectes.
        </p>
        <div className="row">
          <button className="btn sm" onClick={() => void syncNow()}>
            Synchroniser maintenant
          </button>
          <button
            className="btn sm ghost"
            onClick={() => {
              const clear = confirm('Se déconnecter.\n\nOK : effacer aussi les données de cet appareil (elles restent sur GitHub).\nAnnuler : les garder ici.');
              logout(clear);
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'card'}>
      {!compact && <h2>Compte GitHub</h2>}
      <p className="small secondary">
        Connecte-toi avec GitHub pour sauvegarder tes données et les retrouver sur ton téléphone comme sur ton ordinateur. Elles sont stockées dans un gist secret de ton
        propre compte : personne d’autre n’y a accès.
      </p>
      {(error || msg) && <div className="callout" style={{ borderColor: 'var(--critical)' }}>{msg || error}</div>}
      {OAUTH_ENABLED && (
        <button className="btn primary block" onClick={startOAuth}>
          <GitHubMark /> Se connecter avec GitHub
        </button>
      )}
      {OAUTH_ENABLED && !showToken && (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setShowToken(true)}>
          Utiliser un jeton d’accès à la place
        </button>
      )}
      {showToken && (
        <div className="stack" style={{ marginTop: OAUTH_ENABLED ? 12 : 0 }}>
          <ol className="small secondary" style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              <a href={TOKEN_URL} target="_blank" rel="noreferrer">
                Crée un jeton GitHub
              </a>{' '}
              avec uniquement la permission <b>gist</b> (choisis une date d’expiration).
            </li>
            <li>Colle-le ci-dessous. Il reste sur cet appareil et sert seulement à lire/écrire ton gist New Shape.</li>
          </ol>
          <label className="field">
            Jeton d’accès GitHub
            <input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ghp_… ou github_pat_…" />
          </label>
          <button className={`btn ${OAUTH_ENABLED ? '' : 'primary'}`} disabled={busy || value.trim().length < 20} onClick={connect}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
      )}
    </div>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
