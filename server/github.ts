import { GITHUB_LOGIN_RE, HANDLE_RE, nowIso, randomId, userByGithub, userByHandle } from './db';
import { cookie, cookieName, createSession, currentUser, getCookie, HttpError, redirect } from './http';
import type { Env, UserRow } from './types';

/**
 * Connexion avec GitHub. GitHub sert uniquement à prouver l'identité :
 * - connexion / liaison : aucune permission demandée, le jeton est révoqué juste après avoir lu le profil ;
 * - import : permission « gist » le temps de lire l'ancien gist New Shape, puis révoquée aussitôt.
 * Le jeton GitHub n'est jamais envoyé au navigateur ni conservé.
 */

type Mode = 'login' | 'link' | 'import';
const STATE = 'ns_oauth';
const DATA_FILE = 'new-shape-data.json';
const SHARE_FILE = 'new-shape-share.json';
const MAX_IMPORT = 2_000_000;

const callbackUrl = (request: Request) => `${new URL(request.url).origin}/api/auth/github/callback`;

/** Retour vers l'app avec le résultat dans l'URL (lu puis effacé par l'app). */
const back = (request: Request, params: Record<string, string>, headers: HeadersInit = {}) =>
  redirect(`${new URL(request.url).origin}/?${new URLSearchParams(params)}#profile`, headers);

export function startGithub(env: Env, request: Request): Response {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new HttpError(503, 'github_not_configured');
  const mode = (new URL(request.url).searchParams.get('mode') ?? 'login') as Mode;
  if (!['login', 'link', 'import'].includes(mode)) throw new HttpError(400, 'bad_mode');
  const state = randomId(24);
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl(request),
    state,
    // Aucune permission pour se connecter (profil public seulement) ; « gist » uniquement pour l'import.
    scope: mode === 'import' ? 'gist' : '',
    allow_signup: 'true',
  });
  // L'état anti-CSRF et le mode voyagent dans un cookie HttpOnly limité au retour OAuth, valable 10 minutes.
  return redirect(`https://github.com/login/oauth/authorize?${params}`, { 'Set-Cookie': cookie(request, STATE, `${state}.${mode}`, 600, '/api/auth/github') });
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'new-shape', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new HttpError(502, `github_${res.status}`);
  return res.json() as Promise<T>;
}

/** Invalide le jeton chez GitHub : il ne sert plus à rien après la lecture du profil. */
async function revoke(env: Env, token: string) {
  try {
    await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/json',
        'User-Agent': 'new-shape',
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch {
    /* au pire, le jeton sans permission expire de lui-même */
  }
}

/** Pseudo libre à partir du pseudo GitHub (si un compte Face ID l'a déjà pris : suffixe -gh, -gh2…). */
async function freeHandle(env: Env, login: string): Promise<string> {
  const base = HANDLE_RE.test(login) ? login : `${login}-gh`.replace(/^-+/, '').slice(0, 36);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 33)}-gh${i > 1 ? i : ''}`;
    if (HANDLE_RE.test(candidate) && !(await userByHandle(env.DB, candidate))) return candidate;
  }
  return `user-${randomId(6).toLowerCase().replace(/[^a-z\d]/g, '0')}`;
}

export async function githubCallback(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clearState = { 'Set-Cookie': cookie(request, STATE, '', 0, '/api/auth/github') };
  const fail = (code: string) => back(request, { auth_error: code }, clearState);

  const saved = getCookie(request, cookieName(request, STATE, '/api/auth/github')) ?? '';
  const [expected, mode] = saved.split('.') as [string, Mode | undefined];
  if (url.searchParams.get('error')) return fail('github_cancelled');
  const code = url.searchParams.get('code') ?? '';
  if (!expected || !mode || url.searchParams.get('state') !== expected) return fail('bad_state');
  if (!/^[\w-]{4,100}$/.test(code)) return fail('bad_code');

  let token: string | undefined;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'new-shape' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callbackUrl(request) }),
    });
    token = ((await tokenRes.json().catch(() => ({}))) as { access_token?: string }).access_token;
  } catch {
    /* GitHub injoignable */
  }
  if (!token) return fail('github_exchange');

  try {
    const gu = await gh<{ id: number; login: string; name: string | null; avatar_url: string }>(token, '/user');
    if (!GITHUB_LOGIN_RE.test(gu.login) || !Number.isSafeInteger(gu.id)) return fail('github_profile');
    const avatar = typeof gu.avatar_url === 'string' && gu.avatar_url.startsWith('https://avatars.githubusercontent.com/') ? gu.avatar_url : null;
    const name = typeof gu.name === 'string' ? gu.name.slice(0, 100) : null;

    const signedIn = await currentUser(env, request);
    const owner = await userByGithub(env.DB, gu.id);
    let user: UserRow;

    if (mode === 'link' || (mode === 'import' && signedIn)) {
      // Relier GitHub au compte connecté (ou importer pour ce compte).
      if (!signedIn) return fail('not_signed_in');
      if (owner && owner.id !== signedIn.id) return fail('github_already_linked');
      await env.DB.prepare('UPDATE users SET github_id = ?, avatar_url = COALESCE(avatar_url, ?), name = COALESCE(name, ?) WHERE id = ?').bind(gu.id, avatar, name, signedIn.id).run();
      user = signedIn;
    } else if (owner) {
      await env.DB.prepare('UPDATE users SET avatar_url = ?, name = ? WHERE id = ?').bind(avatar, name, owner.id).run();
      user = owner;
    } else {
      const id = randomId();
      await env.DB.prepare('INSERT INTO users (id, handle, name, avatar_url, github_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, await freeHandle(env, gu.login), name, avatar, gu.id, nowIso())
        .run();
      user = (await userByGithub(env.DB, gu.id))!;
    }

    let imported = '';
    if (mode === 'import') imported = await importGist(env, token, user.id);

    const headers = new Headers(clearState);
    if (!signedIn || signedIn.id !== user.id) headers.append('Set-Cookie', await createSession(env, request, user.id));
    return back(request, { auth: mode, ...(mode === 'import' ? { import: imported } : {}) }, headers);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.code.startsWith('github_') ? 'github_unavailable' : e.code);
    throw e;
  } finally {
    await revoke(env, token);
  }
}

interface Gist {
  id: string;
  files: Record<string, { size?: number; raw_url?: string; truncated?: boolean; content?: string } | undefined>;
}

/**
 * Lit l'ancien gist secret de données et le met de côté pour que l'app le fusionne avec ce qu'elle a.
 * Supprime aussi l'ancien gist PUBLIC de partage avec les amis (le partage passe désormais par le serveur, réservé aux amis).
 */
async function importGist(env: Env, token: string, userId: string): Promise<'ok' | 'none'> {
  let data: Gist | undefined;
  let share: Gist | undefined;
  for (let page = 1; page <= 10 && !(data && share); page++) {
    const gists = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    data ??= gists.find((g) => g.files[DATA_FILE]);
    share ??= gists.find((g) => g.files[SHARE_FILE]);
    if (gists.length < 100) break;
  }
  if (share && /^[0-9a-f]{1,64}$/i.test(share.id)) {
    await fetch(`https://api.github.com/gists/${share.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'new-shape', Accept: 'application/vnd.github+json' } }).catch(() => undefined);
  }
  if (!data || !/^[0-9a-f]{1,64}$/i.test(data.id)) return 'none';
  const full = await gh<Gist>(token, `/gists/${data.id}`);
  const f = full.files[DATA_FILE];
  if (!f || (f.size ?? 0) > MAX_IMPORT) return 'none';
  let content = f.content;
  if (f.truncated && f.raw_url?.startsWith('https://gist.githubusercontent.com/')) content = await (await fetch(f.raw_url)).text();
  if (!content || content.length > MAX_IMPORT) return 'none';
  try {
    const p = JSON.parse(content) as { app?: string; data?: unknown };
    if (p.app !== 'new-shape' || typeof p.data !== 'object') return 'none';
  } catch {
    return 'none';
  }
  await env.DB.prepare('INSERT INTO imports (user_id, payload, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at')
    .bind(userId, content, nowIso())
    .run();
  return 'ok';
}
