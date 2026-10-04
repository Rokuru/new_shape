import { nowIso, randomId, sha256, userById } from './db';
import type { Env, UserRow } from './types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  new Headers(headers).forEach((v, k) => h.append(k, v));
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function redirect(location: string, headers: HeadersInit = {}): Response {
  const h = new Headers({ Location: location, ...SECURITY_HEADERS });
  new Headers(headers).forEach((v, k) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
}

/** Lit un corps JSON de taille limitée. */
export async function readJson<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim();
  if (type !== 'application/json') throw new HttpError(415, 'invalid_content_type');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/**
 * Protection CSRF : toute requête qui modifie quelque chose doit venir de l'app elle-même.
 * Le cookie de session est déjà SameSite=Lax ; on vérifie en plus l'origine déclarée par le navigateur.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  const self = new URL(request.url).origin;
  if (origin !== self) throw new HttpError(403, 'bad_origin');
}

export function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * Cookie sûr : HttpOnly (illisible par le JavaScript de la page, donc impossible à voler par un script injecté),
 * Secure (https uniquement) et SameSite=Lax (pas envoyé par les requêtes venant d'autres sites).
 * En développement local (http://localhost), le préfixe __Host- et Secure sont retirés.
 */
export function cookie(request: Request, name: string, value: string, maxAgeSec: number, path = '/'): string {
  const secure = new URL(request.url).protocol === 'https:';
  const full = secure && path === '/' ? `__Host-${name}` : name;
  return [`${full}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAgeSec}`, 'HttpOnly', 'SameSite=Lax', ...(secure ? ['Secure'] : [])].join('; ');
}

export function cookieName(request: Request, name: string, path = '/'): string {
  return new URL(request.url).protocol === 'https:' && path === '/' ? `__Host-${name}` : name;
}

// ---------- Sessions ----------

const SESSION = 'ns_session';
const SESSION_DAYS = 60;

/** Crée une session : seul le hachage du jeton est stocké (une fuite de la base ne permet pas de se connecter). */
export async function createSession(env: Env, request: Request, userId: string): Promise<string> {
  const token = randomId(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, nowIso(), expires).run();
  // Ménage des sessions expirées (peu coûteux, à chaque connexion).
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()).run();
  return cookie(request, SESSION, token, SESSION_DAYS * 86_400);
}

export function clearSessionCookie(request: Request): string {
  return cookie(request, SESSION, '', 0);
}

export async function currentUser(env: Env, request: Request): Promise<UserRow | undefined> {
  const token = getCookie(request, cookieName(request, SESSION));
  if (!token || token.length > 100) return undefined;
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE id_hash = ?').bind(await sha256(token)).first<{ user_id: string; expires_at: string }>();
  if (!row || row.expires_at < nowIso()) return undefined;
  return (await userById(env.DB, row.user_id)) ?? undefined;
}

export async function requireUser(env: Env, request: Request): Promise<UserRow> {
  const user = await currentUser(env, request);
  if (!user) throw new HttpError(401, 'not_signed_in');
  return user;
}

export async function destroySession(env: Env, request: Request) {
  const token = getCookie(request, cookieName(request, SESSION));
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(token)).run();
}
