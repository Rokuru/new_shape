import { AVATAR_PRESETS, avatarOf, ensureSchema, GITHUB_LOGIN_RE, HANDLE_RE, nowIso, publicUser, userByHandle } from './db';
import { githubCallback, startGithub } from './github';
import { assertSameOrigin, clearSessionCookie, destroySession, HttpError, json, readJson, requireUser } from './http';
import { loginOptions, loginVerify, registerOptions, registerVerify } from './passkey';
import type { Env } from './types';

/** Données d'un utilisateur : 1,9 Mo maximum (limite d'une ligne D1 : 2 Mo). */
const MAX_DATA = 1_900_000;
const MAX_SHARE = 512 * 1024;
const MAX_FRIENDS = 200;

/** Photo de profil : 200 Ko maximum (l'app envoie une image de 256 px, ~20–40 Ko). */
const MAX_AVATAR = 200 * 1024;
const MAX_AVATAR_JSON = Math.ceil((MAX_AVATAR * 4) / 3) + 1024;

/** Vérifie une image envoyée en data URL : type autorisé ET contenu réel conforme (signature du fichier), taille limitée. */
function parseImage(v: unknown): { mime: string; data: string } {
  const m = typeof v === 'string' ? v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/) : null;
  if (!m) throw new HttpError(400, 'invalid_image');
  const [, mime, data] = m;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } catch {
    throw new HttpError(400, 'invalid_image');
  }
  if (bytes.length > MAX_AVATAR) throw new HttpError(413, 'too_large');
  const sig = (...b: number[]) => b.every((x, i) => bytes[i] === x);
  const ok =
    (mime === 'image/jpeg' && sig(0xff, 0xd8, 0xff)) ||
    (mime === 'image/png' && sig(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
    (mime === 'image/webp' && sig(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
  if (!ok) throw new HttpError(400, 'invalid_image');
  return { mime, data };
}

const isLogin = (s: unknown): s is string => typeof s === 'string' && (HANDLE_RE.test(s) || GITHUB_LOGIN_RE.test(s));

function parseApp(text: unknown, app: string, max: number): string {
  if (typeof text !== 'string' || text.length > max) throw new HttpError(413, 'too_large');
  try {
    const p = JSON.parse(text) as { app?: unknown };
    if (p?.app !== app) throw new Error();
  } catch {
    throw new HttpError(400, 'invalid_payload');
  }
  return text;
}

async function route(env: Env, request: Request, path: string): Promise<Response> {
  const method = request.method;
  const db = env.DB;
  if (method !== 'GET' && method !== 'HEAD') assertSameOrigin(request);

  // ---------- Connexion ----------
  if (path === '/auth/github' && method === 'GET') return startGithub(env, request);
  if (path === '/auth/github/callback' && method === 'GET') return githubCallback(env, request);
  if (path === '/passkey/register/options' && method === 'POST') return registerOptions(env, request);
  if (path === '/passkey/register/verify' && method === 'POST') return registerVerify(env, request);
  if (path === '/passkey/login/options' && method === 'POST') return loginOptions(env, request);
  if (path === '/passkey/login/verify' && method === 'POST') return loginVerify(env, request);

  if (path === '/logout' && method === 'POST') {
    await destroySession(env, request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
  }

  const user = await requireUser(env, request);

  if (path === '/me' && method === 'GET') {
    const keys = await db.prepare('SELECT id, label, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at').bind(user.id).all<{ id: string; label: string | null; created_at: string; last_used_at: string | null }>();
    return json({
      user: publicUser(user, await avatarOf(db, user.id)),
      passkeys: keys.results.map((k) => ({ id: k.id, label: k.label, createdAt: k.created_at, lastUsedAt: k.last_used_at })),
      githubConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    });
  }

  const passkeyMatch = path.match(/^\/passkeys\/([\w-]{1,512})$/);
  if (passkeyMatch && method === 'DELETE') {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?').bind(user.id).first<{ n: number }>();
    // Jamais sans moyen de connexion : sans GitHub, on garde au moins une clé.
    if (user.github_id === null && (count?.n ?? 0) <= 1) throw new HttpError(409, 'last_method');
    await db.prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?').bind(passkeyMatch[1], user.id).run();
    return json({ ok: true });
  }

  // ---------- Photo de profil ----------
  if (path === '/avatar' && method === 'PUT') {
    const body = await readJson<{ kind?: unknown; preset?: unknown; image?: unknown }>(request, MAX_AVATAR_JSON);
    if (body.kind === 'upload') {
      const { mime, data } = parseImage(body.image);
      await db.prepare('INSERT INTO avatars (user_id, kind, preset, mime, data, updated_at) VALUES (?, ?, NULL, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET kind = excluded.kind, preset = NULL, mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at')
        .bind(user.id, 'upload', mime, data, nowIso())
        .run();
    } else if (body.kind === 'preset' || body.kind === 'github' || body.kind === 'none') {
      const preset = body.kind === 'preset' ? String(body.preset) : null;
      if (preset !== null && !AVATAR_PRESETS.includes(preset)) throw new HttpError(400, 'invalid_preset');
      if (body.kind === 'github' && !user.avatar_url) throw new HttpError(400, 'no_github_avatar');
      await db.prepare('INSERT INTO avatars (user_id, kind, preset, mime, data, updated_at) VALUES (?, ?, ?, NULL, NULL, ?) ON CONFLICT(user_id) DO UPDATE SET kind = excluded.kind, preset = excluded.preset, mime = NULL, data = NULL, updated_at = excluded.updated_at')
        .bind(user.id, body.kind, preset, nowIso())
        .run();
    } else throw new HttpError(400, 'invalid_kind');
    return json({ user: publicUser(user, await avatarOf(db, user.id)) });
  }

  const avatarMatch = path.match(/^\/avatar\/([\w-]{1,64})$/);
  if (avatarMatch && method === 'GET') {
    const row = await db.prepare("SELECT mime, data FROM avatars WHERE user_id = ? AND kind = 'upload'").bind(avatarMatch[1]).first<{ mime: string; data: string }>();
    if (!row) throw new HttpError(404, 'not_found');
    const bytes = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        'Content-Type': row.mime,
        // Adresse versionnée (?v=) : l'image peut rester en cache ; « private » car réservée aux utilisateurs connectés.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': 'inline',
      },
    });
  }

  if (path === '/account' && method === 'DELETE') {
    // Suppression définitive : données, partage, clés, sessions (cascade) et liens d'amitié qui le visent.
    await db.batch([db.prepare('DELETE FROM follows WHERE friend_handle = ?').bind(user.handle), db.prepare('DELETE FROM users WHERE id = ?').bind(user.id)]);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
  }

  // ---------- Données ----------
  if (path === '/data' && method === 'GET') {
    const row = await db.prepare('SELECT payload, version, updated_at FROM user_data WHERE user_id = ?').bind(user.id).first<{ payload: string; version: number; updated_at: string }>();
    return json(row ? { version: row.version, updatedAt: row.updated_at, payload: row.payload } : { version: 0 });
  }

  if (path === '/data' && method === 'PUT') {
    const body = await readJson<{ payload?: unknown; baseVersion?: unknown }>(request, MAX_DATA + 10_000);
    const payload = parseApp(body.payload, 'new-shape', MAX_DATA);
    const base = Number(body.baseVersion);
    if (!Number.isSafeInteger(base) || base < 0) throw new HttpError(400, 'bad_version');
    // Écriture conditionnelle : si un autre appareil a écrit entre-temps, refus (409) et l'app fusionne.
    const res =
      base === 0
        ? await db.prepare('INSERT INTO user_data (user_id, payload, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(user.id, payload, nowIso()).run()
        : await db.prepare('UPDATE user_data SET payload = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?').bind(payload, nowIso(), user.id, base).run();
    if (!res.meta.changes) {
      const row = await db.prepare('SELECT payload, version, updated_at FROM user_data WHERE user_id = ?').bind(user.id).first<{ payload: string; version: number; updated_at: string }>();
      return json({ error: 'conflict', version: row?.version ?? 0, updatedAt: row?.updated_at, payload: row?.payload }, 409);
    }
    return json({ version: base + 1 });
  }

  if (path === '/import' && method === 'GET') {
    const row = await db.prepare('SELECT payload FROM imports WHERE user_id = ?').bind(user.id).first<{ payload: string }>();
    return row ? json({ payload: row.payload }) : json({ error: 'none' }, 404);
  }
  if (path === '/import' && method === 'DELETE') {
    await db.prepare('DELETE FROM imports WHERE user_id = ?').bind(user.id).run();
    return json({ ok: true });
  }

  // ---------- Partage entre amis ----------
  if (path === '/share' && method === 'PUT') {
    const body = await readJson<{ enabled?: unknown; payload?: unknown; friends?: unknown }>(request, MAX_SHARE + 20_000);
    const friends = Array.isArray(body.friends) ? [...new Set(body.friends.filter(isLogin).map((f) => f.toLowerCase()))].slice(0, MAX_FRIENDS) : [];
    const stmts = [db.prepare('DELETE FROM follows WHERE user_id = ?').bind(user.id), ...friends.map((f) => db.prepare('INSERT INTO follows (user_id, friend_handle) VALUES (?, ?)').bind(user.id, f))];
    if (body.enabled === true) {
      const payload = parseApp(body.payload, 'new-shape-share', MAX_SHARE);
      stmts.push(db.prepare('INSERT INTO shares (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at').bind(user.id, payload, nowIso()));
    } else stmts.push(db.prepare('DELETE FROM shares WHERE user_id = ?').bind(user.id));
    await db.batch(stmts);
    return json({ ok: true, publishedAt: body.enabled === true ? nowIso() : undefined });
  }

  const friendMatch = path.match(/^\/friends\/([^/]{1,39})$/);
  if (friendMatch && method === 'GET') {
    const handle = decodeURIComponent(friendMatch[1]);
    if (!isLogin(handle)) return json({ status: 'not_found' });
    const target = await userByHandle(db, handle);
    if (!target) return json({ status: 'not_found' });
    const info = publicUser(target, await avatarOf(db, target.id));
    // Le partage n'est visible qu'entre amis mutuels (chacun a ajouté l'autre) : personne ne peut lire les progrès d'un inconnu.
    const follows = (from: string, handle: string) => db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND friend_handle = ?').bind(from, handle).first();
    const mutual = target.id === user.id || Boolean((await follows(target.id, user.handle)) && (await follows(user.id, target.handle)));
    if (!mutual) return json({ user: info, status: 'not_mutual' });
    const share = await db.prepare('SELECT payload FROM shares WHERE user_id = ?').bind(target.id).first<{ payload: string }>();
    if (!share) return json({ user: info, status: 'not_shared', mutual: true });
    return json({ user: info, status: 'ok', mutual: true, share: share.payload });
  }

  throw new HttpError(404, 'not_found');
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  try {
    if (!env.DB) throw new HttpError(503, 'database_not_configured');
    await ensureSchema(env.DB);
    return await route(env, request, path);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    console.error(e);
    return json({ error: 'server_error' }, 500);
  }
}
