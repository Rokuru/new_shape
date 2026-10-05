// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../app';
import { ensureSchema } from '../db';
import { memoryD1 } from './d1';
import type { Env } from '../types';

const ORIGIN = 'https://new-shape.pages.dev';

/** Navigateur simulé : garde ses cookies, envoie l'en-tête Origin comme un vrai navigateur pour les écritures. */
function browser(env: Env) {
  const jar = new Map<string, string>();
  const send = async (path: string, init: { method?: string; body?: unknown; origin?: string | null; headers?: Record<string, string> } = {}) => {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    if (jar.size) headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const origin = init.origin === undefined ? (method === 'GET' ? null : ORIGIN) : init.origin;
    if (origin) headers.set('Origin', origin);
    const res = await handle(new Request(ORIGIN + path, { method, headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined, redirect: 'manual' }), env);
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (/Max-Age=0/.test(c)) jar.delete(name);
      else jar.set(name, value);
    }
    return res;
  };
  return { send, jar, json: async (path: string, init?: Parameters<typeof send>[1]) => (await send(path, init)).json() as Promise<Record<string, unknown>> };
}

// ---------- GitHub simulé ----------
let ghUser = { id: 42, login: 'Rokuru', name: 'Vincent', avatar_url: 'https://avatars.githubusercontent.com/u/42' };
const calls: string[] = [];
const legacyData = { app: 'new-shape', version: 1, updatedAt: '2026-09-01T10:00:00.000Z', data: { onboarded: true, workouts: [{ id: 'w1' }], body: [] } };

function githubFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const method = init?.method ?? 'GET';
  calls.push(`${method} ${url.replace(/\?.*/, '')}`);
  const res = (body: unknown, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));
  if (url === 'https://github.com/login/oauth/access_token') {
    const code = JSON.parse(String(init?.body)).code;
    return res(code === 'bad-code' ? { error: 'bad_verification_code' } : { access_token: 'gho_test' });
  }
  if (url === 'https://api.github.com/user') return res(ghUser);
  if (url.startsWith('https://api.github.com/gists?')) return res([{ id: 'aa11', files: { 'new-shape-data.json': {} } }, { id: 'bb22', files: { 'new-shape-share.json': {} } }]);
  if (url === 'https://api.github.com/gists/aa11') return res({ id: 'aa11', files: { 'new-shape-data.json': { size: 100, content: JSON.stringify(legacyData) } } });
  if (url === 'https://api.github.com/gists/bb22' && method === 'DELETE') return res(null, 204);
  if (url.startsWith('https://api.github.com/applications/')) return res(null, 204);
  return res({ message: 'not found' }, 404);
}

let env: Env;
beforeEach(() => {
  env = { DB: memoryD1(), GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'secret' };
  calls.length = 0;
  ghUser = { id: 42, login: 'Rokuru', name: 'Vincent', avatar_url: 'https://avatars.githubusercontent.com/u/42' };
  vi.stubGlobal('fetch', vi.fn(githubFetch));
});
afterEach(() => vi.unstubAllGlobals());

/** Parcours complet de connexion GitHub : départ → GitHub → retour sur l'app. */
async function githubLogin(b: ReturnType<typeof browser>, mode = 'login', code = 'good-code') {
  const start = await b.send(`/api/auth/github?mode=${mode}`);
  const to = new URL(start.headers.get('Location')!);
  const back = await b.send(`/api/auth/github/callback?code=${code}&state=${to.searchParams.get('state')}`);
  return { to, back: new URL(back.headers.get('Location')!) };
}

describe('connexion GitHub', () => {
  it('ne demande aucune permission, crée le compte, ouvre une session et révoque le jeton GitHub', async () => {
    const b = browser(env);
    const { to, back } = await githubLogin(b);
    expect(to.origin).toBe('https://github.com');
    expect(to.searchParams.get('scope')).toBe('');
    expect(to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/github/callback`);
    expect(back.searchParams.get('auth')).toBe('login');
    const me = await b.json('/api/me');
    expect(me.user).toEqual({ login: 'Rokuru', name: 'Vincent', avatarUrl: 'https://avatars.githubusercontent.com/u/42', github: true });
    expect(calls).toContain('DELETE https://api.github.com/applications/cid/token');
    // Session : cookie HttpOnly, Secure, SameSite=Lax, et seul son hachage est en base.
    const token = [...b.jar].find(([k]) => k === '__Host-ns_session')![1];
    const row = (env.DB as ReturnType<typeof memoryD1>).raw.prepare('SELECT id_hash FROM sessions').get() as { id_hash: string };
    expect(row.id_hash).not.toBe(token);
    expect(row.id_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuse un retour dont l’état ne correspond pas (CSRF de connexion)', async () => {
    const b = browser(env);
    await b.send('/api/auth/github?mode=login');
    const res = await b.send('/api/auth/github/callback?code=good-code&state=forged');
    expect(new URL(res.headers.get('Location')!).searchParams.get('auth_error')).toBe('bad_state');
    expect((await b.send('/api/me')).status).toBe(401);
    // Sans le cookie d'état (attaquant qui envoie son propre lien) : refusé aussi.
    const other = browser(env);
    const r2 = await other.send('/api/auth/github/callback?code=good-code&state=whatever');
    expect(new URL(r2.headers.get('Location')!).searchParams.get('auth_error')).toBe('bad_state');
  });

  it('code invalide : message d’erreur, pas de session', async () => {
    const b = browser(env);
    const { back } = await githubLogin(b, 'login', 'bad-code');
    expect(back.searchParams.get('auth_error')).toBe('github_exchange');
    expect((await b.send('/api/me')).status).toBe(401);
  });

  it('pseudo déjà pris par un compte Face ID : le compte GitHub reçoit un pseudo distinct', async () => {
    await ensureSchema(env.DB);
    (env.DB as ReturnType<typeof memoryD1>).raw.prepare("INSERT INTO users (id, handle, created_at) VALUES ('x', 'rokuru', '2026-01-01')").run();
    const b = browser(env);
    await githubLogin(b);
    expect((await b.json('/api/me')).user).toMatchObject({ login: 'Rokuru-gh', github: true });
  });

  it('reconnexion : même compte, pas de doublon', async () => {
    await githubLogin(browser(env));
    await githubLogin(browser(env));
    const n = (env.DB as ReturnType<typeof memoryD1>).raw.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    expect(n.n).toBe(1);
  });

  it('import : permission gist le temps de l’import, ancien partage public supprimé, données mises de côté', async () => {
    const b = browser(env);
    await githubLogin(b);
    calls.length = 0;
    const { to, back } = await githubLogin(b, 'import');
    expect(to.searchParams.get('scope')).toBe('gist');
    expect(back.searchParams.get('import')).toBe('ok');
    expect(calls).toContain('DELETE https://api.github.com/gists/bb22');
    expect(calls).toContain('DELETE https://api.github.com/applications/cid/token');
    expect(calls).not.toContain('DELETE https://api.github.com/gists/aa11');
    const imp = await b.json('/api/import');
    expect(JSON.parse(String(imp.payload))).toEqual(legacyData);
    expect((await b.send('/api/import', { method: 'DELETE' })).status).toBe(200);
    expect((await b.send('/api/import')).status).toBe(404);
  });
});

describe('données', () => {
  const payload = (n: number) => JSON.stringify({ app: 'new-shape', version: 1, updatedAt: `2026-10-0${n}T00:00:00.000Z`, data: { n } });

  it('écriture conditionnelle : un appareil en retard reçoit un conflit avec la version à jour', async () => {
    const a = browser(env);
    await githubLogin(a);
    expect(await a.json('/api/data')).toEqual({ version: 0 });
    expect(await a.json('/api/data', { method: 'PUT', body: { payload: payload(1), baseVersion: 0 } })).toEqual({ version: 1 });
    const stale = await a.send('/api/data', { method: 'PUT', body: { payload: payload(2), baseVersion: 0 } });
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as { version: number; payload: string };
    expect(body.version).toBe(1);
    expect(body.payload).toBe(payload(1));
    expect(await a.json('/api/data', { method: 'PUT', body: { payload: payload(3), baseVersion: 1 } })).toEqual({ version: 2 });
  });

  it('refuse un contenu invalide ou trop gros', async () => {
    const a = browser(env);
    await githubLogin(a);
    expect((await a.send('/api/data', { method: 'PUT', body: { payload: '{"app":"autre"}', baseVersion: 0 } })).status).toBe(400);
    expect((await a.send('/api/data', { method: 'PUT', body: { payload: 'x'.repeat(2_000_000), baseVersion: 0 } })).status).toBe(413);
  });

  it('protections : pas de session → 401, autre site → 403, mauvais type → 415', async () => {
    const a = browser(env);
    expect((await a.send('/api/data')).status).toBe(401);
    await githubLogin(a);
    expect((await a.send('/api/data', { method: 'PUT', body: { payload: payload(1), baseVersion: 0 }, origin: 'https://evil.example' })).status).toBe(403);
    expect((await a.send('/api/data', { method: 'PUT', body: { payload: payload(1), baseVersion: 0 }, origin: null })).status).toBe(403);
    expect((await a.send('/api/data', { method: 'PUT', body: { payload: payload(1), baseVersion: 0 }, headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
  });

  it('déconnexion : la session est supprimée côté serveur', async () => {
    const a = browser(env);
    await githubLogin(a);
    const cookie = [...a.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    await a.send('/api/logout', { method: 'POST' });
    const replay = await handle(new Request(ORIGIN + '/api/me', { headers: { Cookie: cookie } }), env);
    expect(replay.status).toBe(401);
  });
});

describe('amis', () => {
  const share = JSON.stringify({ app: 'new-shape-share', version: 1, updatedAt: '', profile: {}, stats: {}, lifts: {}, weekly: [], recent: [], friends: [] });

  it('partage visible uniquement entre amis mutuels, et plus du tout après suppression du compte', async () => {
    const alex = browser(env);
    ghUser = { id: 1, login: 'alex', name: null, avatar_url: '' };
    await githubLogin(alex);
    const sam = browser(env);
    ghUser = { id: 2, login: 'sam', name: null, avatar_url: '' };
    await githubLogin(sam);
    const eve = browser(env);
    ghUser = { id: 3, login: 'eve', name: null, avatar_url: '' };
    await githubLogin(eve);

    await alex.send('/api/share', { method: 'PUT', body: { enabled: true, payload: share, friends: ['sam', 'eve'] } });
    expect(await sam.json('/api/friends/alex')).toMatchObject({ status: 'not_mutual' });
    await sam.send('/api/share', { method: 'PUT', body: { enabled: false, friends: ['alex'] } });
    expect(await sam.json('/api/friends/alex')).toMatchObject({ status: 'ok', mutual: true, share });
    // Alex voit Sam comme ami mutuel, mais Sam ne partage pas.
    expect(await alex.json('/api/friends/sam')).toMatchObject({ status: 'not_shared', mutual: true });
    // Eve a été ajoutée par Alex mais ne l'a pas ajouté : pas d'accès.
    expect((await eve.json('/api/friends/alex')).share).toBeUndefined();
    expect(await eve.json('/api/friends/inconnu')).toEqual({ status: 'not_found' });

    // Alex supprime son compte : plus rien de lisible, et son pseudo n'est plus suivi.
    await alex.send('/api/account', { method: 'DELETE' });
    expect(await sam.json('/api/friends/alex')).toEqual({ status: 'not_found' });
    const left = (env.DB as ReturnType<typeof memoryD1>).raw.prepare("SELECT COUNT(*) AS n FROM follows WHERE friend_handle = 'alex'").get() as { n: number };
    expect(left.n).toBe(0);
  });

  it('liste d’amis nettoyée (pseudos invalides écartés, 200 max)', async () => {
    const a = browser(env);
    await githubLogin(a);
    await a.send('/api/share', { method: 'PUT', body: { enabled: false, friends: ['ok-1', '<script>', 'x'.repeat(60), ...Array.from({ length: 300 }, (_, i) => `f${i}`)] } });
    const rows = (env.DB as ReturnType<typeof memoryD1>).raw.prepare('SELECT friend_handle FROM follows').all() as { friend_handle: string }[];
    expect(rows.length).toBe(200);
    expect(rows.some((r) => r.friend_handle.includes('<'))).toBe(false);
  });
});

describe('clés d’accès', () => {
  it('impossible de supprimer son seul moyen de connexion', async () => {
    const db = (env.DB as ReturnType<typeof memoryD1>);
    const a = browser(env);
    await githubLogin(a);
    // Compte sans GitHub avec une seule clé.
    db.raw.prepare('UPDATE users SET github_id = NULL').run();
    db.raw.prepare("INSERT INTO passkeys (id, user_id, public_key, created_at) SELECT 'k1', id, 'pk', '2026-01-01' FROM users").run();
    expect((await a.send('/api/passkeys/k1', { method: 'DELETE' })).status).toBe(409);
    db.raw.prepare("INSERT INTO passkeys (id, user_id, public_key, created_at) SELECT 'k2', id, 'pk', '2026-01-01' FROM users").run();
    expect((await a.send('/api/passkeys/k1', { method: 'DELETE' })).status).toBe(200);
  });

  it('création de compte : pseudo invalide ou déjà pris refusé', async () => {
    const a = browser(env);
    expect((await a.send('/api/passkey/register/options', { method: 'POST', body: { handle: 'a b' } })).status).toBe(400);
    await githubLogin(browser(env));
    expect((await a.send('/api/passkey/register/options', { method: 'POST', body: { handle: 'ROKURU' } })).status).toBe(409);
    const ok = await a.json('/api/passkey/register/options', { method: 'POST', body: { handle: 'nouveau' } });
    expect(ok.rp).toEqual({ name: 'New Shape', id: 'new-shape.pages.dev' });
    expect(ok.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' });
  });

  it('vérification sans défi préalable ou avec une réponse forgée : refusée', async () => {
    const a = browser(env);
    expect((await a.send('/api/passkey/login/verify', { method: 'POST', body: { response: { id: 'x' } } })).status).toBe(400);
    await a.send('/api/passkey/login/options', { method: 'POST', body: {} });
    expect((await a.send('/api/passkey/login/verify', { method: 'POST', body: { response: { id: 'inconnue', response: {} } } })).status).toBe(404);
    // Le défi est à usage unique.
    expect((await a.send('/api/passkey/login/verify', { method: 'POST', body: { response: { id: 'inconnue' } } })).status).toBe(400);
  });
});

describe('photo de profil', () => {
  // Plus petit JPEG valable (signature FF D8 FF) et un « PNG » qui est en fait du HTML.
  const jpeg = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, ...Array(60).fill(0)));
  const fakePng = 'data:image/png;base64,' + btoa('<html><script>alert(1)</script></html>');

  it('photo envoyée : vérifiée, servie aux seuls connectés avec des en-têtes protecteurs', async () => {
    const a = browser(env);
    await githubLogin(a);
    const r = await a.json('/api/avatar', { method: 'PUT', body: { kind: 'upload', image: jpeg } });
    const url = String((r.user as { avatarUrl: string }).avatarUrl);
    expect(url).toMatch(/^\/api\/avatar\/[\w-]+\?v=/);
    expect(((await a.json('/api/me')).user as { avatarUrl: string }).avatarUrl).toBe(url);
    const img = await a.send(url);
    expect(img.status).toBe(200);
    expect(img.headers.get('Content-Type')).toBe('image/jpeg');
    expect(img.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(img.headers.get('Content-Security-Policy')).toContain('sandbox');
    expect(new Uint8Array(await img.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    // Sans session : refusé.
    expect((await browser(env).send(url)).status).toBe(401);
  });

  it('refuse un faux fichier image, un format non autorisé et une image trop lourde', async () => {
    const a = browser(env);
    await githubLogin(a);
    expect((await a.send('/api/avatar', { method: 'PUT', body: { kind: 'upload', image: fakePng } })).status).toBe(400);
    expect((await a.send('/api/avatar', { method: 'PUT', body: { kind: 'upload', image: 'data:image/svg+xml;base64,' + btoa('<svg/>') } })).status).toBe(400);
    const big = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(0xff, 0xd8, 0xff) + 'x'.repeat(210 * 1024));
    expect((await a.send('/api/avatar', { method: 'PUT', body: { kind: 'upload', image: big } })).status).toBe(413);
  });

  it('avatar prédéfini, photo GitHub ou initiale ; avatar visible par un ami', async () => {
    const a = browser(env);
    await githubLogin(a);
    expect(((await a.json('/api/avatar', { method: 'PUT', body: { kind: 'preset', preset: 'a05' } })).user as { avatarUrl: string }).avatarUrl).toBe('/avatars/a05.svg');
    expect((await a.send('/api/avatar', { method: 'PUT', body: { kind: 'preset', preset: '../../etc' } })).status).toBe(400);
    expect(((await a.json('/api/avatar', { method: 'PUT', body: { kind: 'none' } })).user as { avatarUrl: string }).avatarUrl).toBe('');
    expect(((await a.json('/api/avatar', { method: 'PUT', body: { kind: 'github' } })).user as { avatarUrl: string }).avatarUrl).toBe('https://avatars.githubusercontent.com/u/42');
    await a.send('/api/avatar', { method: 'PUT', body: { kind: 'preset', preset: 'a02' } });
    const b = browser(env);
    ghUser = { id: 7, login: 'pote', name: null, avatar_url: '' };
    await githubLogin(b);
    expect(((await b.json('/api/friends/Rokuru')).user as { avatarUrl: string }).avatarUrl).toBe('/avatars/a02.svg');
  });
});
