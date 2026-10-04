/**
 * Accès au serveur de l'app (Cloudflare, même adresse que le site).
 * La session est un cookie HttpOnly : le JavaScript de la page ne la voit jamais, rien n'est stocké dans le navigateur.
 */
import { startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

export interface AppUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  /** Compte relié à GitHub (pseudo vérifié par GitHub). */
  github?: boolean;
}

export interface PasskeyInfo {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Messages lisibles pour les codes d'erreur du serveur. */
const MESSAGES: Record<string, string> = {
  not_signed_in: 'Session expirée : reconnecte-toi.',
  invalid_handle: 'Pseudo invalide : 3 à 39 caractères, lettres, chiffres et tirets.',
  handle_taken: 'Ce pseudo est déjà pris, choisis-en un autre.',
  passkey_invalid: 'Clé d’accès refusée.',
  passkey_unknown: 'Cette clé d’accès n’est liée à aucun compte New Shape (compte supprimé ?).',
  challenge_expired: 'Délai dépassé, réessaie.',
  no_challenge: 'Délai dépassé, réessaie.',
  last_method: 'Impossible : c’est ton seul moyen de connexion. Ajoute d’abord une autre clé ou relie GitHub.',
  github_not_configured: 'La connexion GitHub n’est pas encore configurée sur le serveur.',
  database_not_configured: 'Le serveur n’est pas encore configuré (base de données).',
  github_cancelled: 'Connexion GitHub annulée.',
  bad_state: 'Connexion GitHub refusée : réponse inattendue. Réessaie.',
  github_exchange: 'Connexion GitHub impossible (code expiré ou configuration du serveur).',
  github_already_linked: 'Ce compte GitHub est déjà relié à un autre compte New Shape.',
  github_unavailable: 'GitHub ne répond pas, réessaie dans un instant.',
  github_profile: 'Profil GitHub illisible.',
  too_large: 'Données trop volumineuses.',
  bad_origin: 'Requête refusée.',
};
export const explainError = (code: string) => MESSAGES[code] ?? `Erreur du serveur (${code}).`;

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('Hors connexion : synchronisation reportée.', 0, 'offline');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof data.error === 'string' ? data.error : String(res.status);
    throw new ApiError(explainError(code), res.status, code, data);
  }
  return data as T;
}

export interface Me {
  user: AppUser;
  passkeys: PasskeyInfo[];
  githubConfigured: boolean;
}

export const fetchMe = () => api<Me>('/me');

// ---------- Clés d'accès (Face ID / Touch ID) ----------

export const passkeySupported = () => typeof window !== 'undefined' && 'PublicKeyCredential' in window;

/** Nom de l'appareil pour s'y retrouver dans la liste des clés. */
function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Appareil';
}

/** Annulation par l'utilisateur (fenêtre Face ID fermée) : message clair plutôt qu'une erreur technique. */
function webauthnError(e: unknown): Error {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new Error('Opération annulée.');
  if (name === 'InvalidStateError') return new Error('Cet appareil a déjà une clé pour ce compte.');
  return e instanceof Error ? e : new Error(String(e));
}

/** Crée une clé d'accès : nouveau compte (`handle` fourni) ou clé supplémentaire pour le compte connecté. */
export async function registerPasskey(handle?: string) {
  const options = await api<PublicKeyCredentialCreationOptionsJSON>('/passkey/register/options', { method: 'POST', body: { handle } });
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (e) {
    throw webauthnError(e);
  }
  await api('/passkey/register/verify', { method: 'POST', body: { response, label: deviceLabel() } });
}

export async function loginWithPasskey() {
  const options = await api<PublicKeyCredentialRequestOptionsJSON>('/passkey/login/options', { method: 'POST', body: {} });
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (e) {
    throw webauthnError(e);
  }
  await api('/passkey/login/verify', { method: 'POST', body: { response } });
}

export const deletePasskey = (id: string) => api(`/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---------- GitHub ----------

/** Connexion, liaison ou import via GitHub : redirection vers GitHub puis retour sur l'app. */
export function startGithub(mode: 'login' | 'link' | 'import') {
  window.location.assign(`/api/auth/github?mode=${mode}`);
}

/**
 * Retour de GitHub : le serveur renvoie sur l'app avec ?auth=… ou ?auth_error=… (et ?import=ok|none).
 * On lit le résultat puis on nettoie l'adresse.
 */
export function consumeAuthReturn(): { mode?: string; error?: string; imported?: string } | undefined {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('auth') ?? undefined;
  const code = params.get('auth_error');
  if (!mode && !code) return undefined;
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  return { mode, error: code ? explainError(code) : undefined, imported: params.get('import') ?? undefined };
}
