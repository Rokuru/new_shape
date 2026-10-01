/**
 * Accès à l'API GitHub depuis le navigateur.
 * Les données de chaque utilisateur sont stockées dans un gist secret de son propre compte.
 */

export const GITHUB_CLIENT_ID: string = import.meta.env.VITE_GITHUB_CLIENT_ID ?? '';
export const AUTH_PROXY_URL: string = (import.meta.env.VITE_AUTH_PROXY_URL ?? '').replace(/\/$/, '');
/** La connexion OAuth (bouton) n'est possible que si l'app a été construite avec ces deux variables. */
export const OAUTH_ENABLED = Boolean(GITHUB_CLIENT_ID && AUTH_PROXY_URL);

const API = 'https://api.github.com';
export const GIST_FILE = 'new-shape-data.json';
const GIST_DESCRIPTION = 'New Shape – données de suivi musculation (ne pas supprimer)';
const STATE_KEY = 'new-shape-oauth-state';
const RETURN_KEY = 'new-shape-oauth-return';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const msg =
      res.status === 401
        ? 'Jeton GitHub invalide ou expiré.'
        : res.status === 403 || res.status === 404
          ? 'Accès refusé : le jeton doit autoriser les gists (lecture et écriture).'
          : `Erreur GitHub ${res.status}`;
    throw new GitHubError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchUser(token: string): Promise<GitHubUser> {
  const u = await api<{ login: string; name: string | null; avatar_url: string }>(token, '/user');
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url };
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  description: string | null;
  files: Record<string, GistFile | undefined>;
}

/** Cherche le gist de l'app parmi les gists de l'utilisateur. */
/** Cherche un gist de l'app (par nom de fichier) parmi les gists de l'utilisateur connecté. */
export async function findGist(token: string, file = GIST_FILE): Promise<string | undefined> {
  for (let page = 1; page <= 10; page++) {
    const gists = await api<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    const found = gists.find((g) => g.files[file]);
    if (found) return found.id;
    if (gists.length < 100) return undefined;
  }
  return undefined;
}

export async function readGist(token: string, id: string, file = GIST_FILE): Promise<string | undefined> {
  const gist = await api<Gist>(token, `/gists/${id}`);
  const f = gist.files[file];
  if (!f) return undefined;
  // Au-delà de 1 Mo, l'API tronque le contenu : on lit alors le fichier brut.
  if (f.truncated && f.raw_url) {
    const res = await fetch(f.raw_url);
    if (!res.ok) throw new GitHubError(`Lecture du gist impossible (${res.status})`, res.status);
    return res.text();
  }
  return f.content;
}

export async function createGist(token: string, content: string, opts: { file?: string; description?: string; isPublic?: boolean } = {}): Promise<string> {
  const file = opts.file ?? GIST_FILE;
  const gist = await api<Gist>(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({ description: opts.description ?? GIST_DESCRIPTION, public: opts.isPublic ?? false, files: { [file]: { content } } }),
  });
  return gist.id;
}

export async function updateGist(token: string, id: string, content: string, file = GIST_FILE): Promise<void> {
  await api<Gist>(token, `/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [file]: { content } } }) });
}

export async function deleteGist(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/gists/${id}`, { method: 'DELETE', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) throw new GitHubError(`Suppression du partage impossible (${res.status})`, res.status);
}

// ---------- Profils publics (amis) ----------

export const SHARE_FILE = 'new-shape-share.json';
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const isValidLogin = (login: string) => LOGIN_RE.test(login);

/** Avatar uniquement depuis le domaine GitHub (données d'un tiers). */
const safeAvatar = (url: unknown) => (typeof url === 'string' && url.startsWith('https://avatars.githubusercontent.com/') ? url : '');

export async function fetchPublicUser(token: string, login: string): Promise<GitHubUser | undefined> {
  if (!isValidLogin(login)) return undefined;
  try {
    const u = await api<{ login: string; name: string | null; avatar_url: string }>(token, `/users/${encodeURIComponent(login)}`);
    return { login: u.login, name: u.name, avatarUrl: safeAvatar(u.avatar_url) };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return undefined;
    throw e;
  }
}

/** Contenu du partage public New Shape d'un utilisateur, s'il l'a activé. */
export async function fetchPublicShare(token: string, login: string): Promise<string | undefined> {
  for (let page = 1; page <= 3; page++) {
    const gists = await api<Gist[]>(token, `/users/${encodeURIComponent(login)}/gists?per_page=100&page=${page}`);
    const found = gists.find((g) => g.files[SHARE_FILE]);
    if (found) return readGist(token, found.id, SHARE_FILE);
    if (gists.length < 100) return undefined;
  }
  return undefined;
}

// ---------- OAuth ----------

/** Messages compréhensibles pour les erreurs du proxy ou de GitHub (configuration du Worker). */
export function explainOAuthError(code: string): string {
  const c = code.toLowerCase();
  if (c === 'not found') return 'GitHub ne reconnaît pas le Client ID utilisé par le Worker (Not Found).';
  if (c.includes('incorrect_client_credentials') || c.includes('client_id and/or client_secret')) return 'secret OAuth incorrect dans le Worker (GITHUB_CLIENT_SECRET).';
  if (c.includes('redirect_uri')) return 'l’adresse de retour de l’application OAuth GitHub ne correspond pas à celle de l’app.';
  if (c.includes('bad_verification_code') || c.includes('incorrect or expired')) return 'code de connexion expiré, réessaie.';
  if (c === 'missing_secret') return 'le secret GITHUB_CLIENT_SECRET n’est pas défini dans le Worker.';
  if (c === 'origin_not_allowed') return 'le Worker refuse cette adresse (origine non autorisée).';
  return code;
}

/** URL de retour : la page de l'app, sans hash ni paramètres. */
export const redirectUri = () => window.location.origin + window.location.pathname;

export function startOAuth() {
  const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, window.location.hash);
  } catch {
    /* stockage indisponible : la vérification échouera proprement */
  }
  const params = new URLSearchParams({ client_id: GITHUB_CLIENT_ID, redirect_uri: redirectUri(), scope: 'gist read:user', state });
  window.location.assign(`https://github.com/login/oauth/authorize?${params}`);
}

/**
 * Au retour de GitHub (?code=…&state=…) : vérifie l'état anti-CSRF, échange le code contre un jeton
 * via le proxy (qui détient le secret OAuth), puis nettoie l'URL.
 * Renvoie undefined s'il n'y a pas de retour OAuth à traiter.
 */
export async function consumeOAuthCallback(): Promise<string | undefined> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error_description') ?? params.get('error');
  if (!code && !error) return undefined;
  let back = '';
  try {
    back = sessionStorage.getItem(RETURN_KEY) ?? '';
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* rien */
  }
  // Retour à l'onglet de départ, sans le code dans l'URL (ni dans l'historique).
  window.history.replaceState(null, '', redirectUri() + (window.location.hash || back));
  if (error) throw new Error(`Connexion GitHub annulée : ${error}`);
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* rien */
  }
  if (!expected || expected !== state) throw new Error('Connexion GitHub refusée : réponse inattendue (state).');
  const res = await fetch(`${AUTH_PROXY_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri() }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Connexion GitHub impossible : ${explainOAuthError(data.error ?? String(res.status))}`);
  return data.access_token;
}
