import { useEffect, useRef, useState } from 'react';
import { AVATAR_PRESETS, deletePasskey, loginWithPasskey, passkeySupported, prepareAvatar, registerPasskey, setAvatar, startGithub, type AvatarChoice } from '../lib/api';
import { afterSignIn, deleteAccount, logout, refreshSession, syncNow, useAuth } from '../lib/sync';
import { Icon } from './ui';

function ago(iso?: string | null) {
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

export function UserAvatar({ url, login, size = 40 }: { url?: string; login: string; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
  ) : (
    <span className="avatar-initial" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {login.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Exécute une action avec indicateur d'attente et message d'erreur lisible. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, setMsg, run };
}

/** Compte New Shape : connexion sans mot de passe (Face ID / Touch ID ou GitHub), données sur le serveur de l'app. */
export default function AccountCard({ compact }: { compact?: boolean }) {
  const { user, error, notice } = useAuth();
  return user ? <SignedIn /> : <SignedOut compact={compact} error={error} notice={notice} />;
}

function SignedOut({ compact, error, notice }: { compact?: boolean; error?: string; notice?: string }) {
  const { busy, msg, run } = useAction();
  const [creating, setCreating] = useState(false);
  const [handle, setHandle] = useState('');
  const canPasskey = passkeySupported();
  const valid = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){2,38}$/i.test(handle.trim());

  return (
    <div className={compact ? '' : 'card'}>
      {!compact && <h2>Mon compte</h2>}
      <p className="small secondary">
        Connecte-toi pour sauvegarder tes données et les retrouver sur tous tes appareils. Aucun mot de passe : Face ID / Touch ID, ou ton compte GitHub. Tes données ne sont
        accessibles qu’à toi.
      </p>
      {(msg || error || notice) && <div className="callout" style={{ borderColor: msg || error ? 'var(--critical)' : undefined }}>{msg || error || notice}</div>}
      <div className="stack">
        {canPasskey && (
          <button className="btn primary block" disabled={busy} onClick={() => run(async () => (await loginWithPasskey(), await afterSignIn()))}>
            <Icon name="user" size={18} /> Se connecter avec Face ID / Touch ID
          </button>
        )}
        <button className="btn block" disabled={busy} onClick={() => startGithub('login')}>
          <GitHubMark /> Continuer avec GitHub
        </button>
        {canPasskey &&
          (!creating ? (
            <button className="btn ghost sm" onClick={() => setCreating(true)}>
              Pas encore de compte ? Créer un compte avec Face ID
            </button>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) void run(async () => (await registerPasskey(handle.trim()), await afterSignIn()));
              }}
            >
              <label className="field">
                Choisis un pseudo (c’est avec lui que tes amis te trouveront)
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="ex. alex-muscu" autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={39} />
              </label>
              <button className="btn primary" disabled={busy || !valid}>
                {busy ? 'Création…' : 'Créer mon compte avec Face ID'}
              </button>
              <span className="small muted">3 à 39 caractères : lettres, chiffres et tirets.</span>
            </form>
          ))}
      </div>
    </div>
  );
}

function SignedIn() {
  const { user, passkeys = [], githubConfigured, notice } = useAuth();
  const { busy, msg, run } = useAction();
  if (!user) return null;
  const canPasskey = passkeySupported();
  const onlyMethod = !user.github && passkeys.length <= 1;

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
        <UserAvatar url={user.avatarUrl} login={user.login} />
        <div style={{ minWidth: 0 }}>
          <div>
            <b>{user.name || user.login}</b> <span className="small muted">@{user.login}</span>
          </div>
          <SyncBadge />
        </div>
      </div>
      {(msg || notice) && <div className="callout" style={{ marginTop: 10 }}>{msg || notice}</div>}
      <p className="small secondary" style={{ marginTop: 10 }}>
        Tes données sont enregistrées sur le serveur New Shape et synchronisées sur tous les appareils où tu te connectes. Elles ne sont accessibles qu’à toi.
      </p>
      <div className="row">
        <button className="btn sm" onClick={() => void syncNow()}>
          Synchroniser maintenant
        </button>
        <button
          className="btn sm ghost"
          onClick={() => {
            const clear = confirm('Se déconnecter.\n\nOK : effacer aussi les données de cet appareil (elles restent sauvegardées sur ton compte).\nAnnuler : les garder ici.');
            void logout(clear);
          }}
        >
          Se déconnecter
        </button>
      </div>

      <AvatarPicker />

      <h3 style={{ marginTop: 18 }}>Moyens de connexion</h3>
      <div className="list">
        {passkeys.map((k) => (
          <div key={k.id} className="list-item">
            <div style={{ minWidth: 0 }}>
              <b>Face ID / Touch ID · {k.label ?? 'Appareil'}</b>
              <div className="small muted">
                ajoutée le {new Date(k.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                {k.lastUsedAt && ` · utilisée ${ago(k.lastUsedAt)}`}
              </div>
            </div>
            <button
              className="btn ghost sm"
              aria-label="Supprimer cette clé"
              disabled={busy || onlyMethod}
              title={onlyMethod ? 'Ton seul moyen de connexion' : undefined}
              onClick={() => confirm('Supprimer cette clé d’accès ? Cet appareil ne pourra plus se connecter avec Face ID.') && run(async () => (await deletePasskey(k.id), await refreshSession()))}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        <div className="list-item">
          <div>
            <b>
              <GitHubMark /> GitHub
            </b>
            <div className="small muted">{user.github ? 'Relié : tu peux te connecter avec GitHub.' : 'Non relié.'}</div>
          </div>
          {!user.github && githubConfigured && (
            <button className="btn sm" onClick={() => startGithub('link')}>
              Relier
            </button>
          )}
        </div>
      </div>
      {canPasskey && (
        <button className="btn sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => run(async () => (await registerPasskey(), await refreshSession()), 'Clé d’accès ajoutée ✓')}>
          <Icon name="plus" size={14} /> Ajouter Face ID / Touch ID sur cet appareil
        </button>
      )}

      {githubConfigured && (
        <>
          <h3 style={{ marginTop: 18 }}>Ancienne version (gist GitHub)</h3>
          <p className="small secondary">
            Récupère les données sauvegardées par l’ancienne version de New Shape dans ton gist GitHub. Elles sont fusionnées avec celles de ce compte. L’ancien partage
            public avec les amis est supprimé au passage. GitHub ne donne accès à tes gists que le temps de l’import, puis cet accès est retiré.
          </p>
          <button className="btn sm" onClick={() => startGithub('import')}>
            <GitHubMark /> Importer depuis mon gist
          </button>
        </>
      )}

      <details style={{ marginTop: 18 }}>
        <summary className="small muted">Supprimer mon compte</summary>
        <p className="small secondary">Supprime définitivement ton compte et toutes tes données du serveur (séances, mesures, partage). Les données de cet appareil restent.</p>
        <button
          className="btn sm danger"
          disabled={busy}
          onClick={() => confirm('Supprimer définitivement ton compte New Shape et toutes ses données sur le serveur ?') && run(deleteAccount)}
        >
          Supprimer définitivement
        </button>
      </details>
    </div>
  );
}

/** Choix de la photo de profil : photo personnelle, avatar de l'app, photo GitHub ou initiale. */
function AvatarPicker() {
  const { user } = useAuth();
  const { busy, msg, run } = useAction();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const choose = (c: AvatarChoice) =>
    run(async () => {
      const r = await setAvatar(c);
      useAuth.setState({ user: r.user });
    }, 'Photo de profil mise à jour ✓');

  return (
    <>
      <h3 style={{ marginTop: 18 }}>Photo de profil</h3>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <UserAvatar url={user.avatarUrl} login={user.login} size={64} />
        <div className="stack" style={{ gap: 6 }}>
          <button className="btn sm" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Envoi…' : 'Choisir une photo'}
          </button>
          <button className="btn sm ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Masquer les avatars' : 'Choisir un avatar'}
          </button>
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void run(async () => {
            const image = await prepareAvatar(f);
            const r = await setAvatar({ kind: 'upload', image });
            useAuth.setState({ user: r.user });
          }, 'Photo de profil mise à jour ✓');
        }}
      />
      {msg && <p className="small secondary" role="status">{msg}</p>}
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Visible par les personnes connectées qui te cherchent ou te suivent. La photo est recadrée et réduite sur ton appareil, et ses informations cachées (position GPS…)
        sont retirées avant l’envoi.
      </p>
      {open && (
        <div className="avatar-grid">
          {AVATAR_PRESETS.map((id) => (
            <button key={id} className="avatar-choice" disabled={busy} aria-label={`Avatar ${id}`} onClick={() => choose({ kind: 'preset', preset: id })}>
              <img src={`/avatars/${id}.svg`} alt="" width={44} height={44} />
            </button>
          ))}
          {user.github && (
            <button className="avatar-choice text" disabled={busy} onClick={() => choose({ kind: 'github' })}>
              <GitHubMark /> Photo GitHub
            </button>
          )}
          <button className="avatar-choice text" disabled={busy} onClick={() => choose({ kind: 'none' })}>
            Initiale
          </button>
        </div>
      )}
    </>
  );
}

export function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden style={{ verticalAlign: '-3px' }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
