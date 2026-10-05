import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { HANDLE_RE, nowIso, randomId, userByHandle } from './db';
import { cookie, cookieName, createSession, currentUser, getCookie, HttpError, json, readJson } from './http';
import type { Env } from './types';

/**
 * Connexion par clé d'accès (passkey) : Face ID / Touch ID / empreinte, sans mot de passe.
 * La clé privée ne quitte jamais l'appareil (synchronisée par le trousseau iCloud ou Google) ;
 * le serveur ne garde que la clé publique, inutile à un voleur.
 */

const RP_NAME = 'New Shape';
const CHALLENGE = 'ns_webauthn';
const CHALLENGE_TTL = 5 * 60;

const rp = (request: Request) => {
  const u = new URL(request.url);
  return { rpID: u.hostname, origin: u.origin };
};

async function saveChallenge(env: Env, request: Request, challenge: string, kind: 'register' | 'login', userId?: string, handle?: string) {
  const id = randomId();
  await env.DB.prepare('DELETE FROM challenges WHERE expires_at < ?').bind(nowIso()).run();
  await env.DB.prepare('INSERT INTO challenges (id, challenge, kind, user_id, handle, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, challenge, kind, userId ?? null, handle ?? null, new Date(Date.now() + CHALLENGE_TTL * 1000).toISOString())
    .run();
  return cookie(request, CHALLENGE, id, CHALLENGE_TTL);
}

/** Récupère et consomme le défi (usage unique). */
async function takeChallenge(env: Env, request: Request, kind: 'register' | 'login') {
  const id = getCookie(request, cookieName(request, CHALLENGE));
  if (!id) throw new HttpError(400, 'no_challenge');
  const row = await env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(id).first<{ challenge: string; kind: string; user_id: string | null; handle: string | null; expires_at: string }>();
  await env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(id).run();
  if (!row || row.kind !== kind || row.expires_at < nowIso()) throw new HttpError(400, 'challenge_expired');
  return row;
}

const clearChallenge = (request: Request) => cookie(request, CHALLENGE, '', 0);

/** Options de création d'une clé : nouveau compte (pseudo choisi) ou clé supplémentaire pour le compte connecté. */
export async function registerOptions(env: Env, request: Request): Promise<Response> {
  const body = await readJson<{ handle?: string }>(request);
  const signedIn = await currentUser(env, request);
  let handle: string;
  let userId: string;
  let exclude: { id: string; transports?: string[] }[] = [];
  if (signedIn) {
    handle = signedIn.handle;
    userId = signedIn.id;
    const keys = await env.DB.prepare('SELECT id, transports FROM passkeys WHERE user_id = ?').bind(userId).all<{ id: string; transports: string | null }>();
    exclude = keys.results.map((k) => ({ id: k.id, transports: k.transports ? (JSON.parse(k.transports) as string[]) : undefined }));
  } else {
    handle = String(body.handle ?? '').trim();
    if (!HANDLE_RE.test(handle)) throw new HttpError(400, 'invalid_handle');
    if (await userByHandle(env.DB, handle)) throw new HttpError(409, 'handle_taken');
    userId = randomId();
  }
  const { rpID } = rp(request);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: handle,
    userDisplayName: handle,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: exclude,
    // Clé « découvrable » : on se reconnecte sans taper son pseudo.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  const setCookie = await saveChallenge(env, request, options.challenge, 'register', userId, signedIn ? undefined : handle);
  return json(options, 200, { 'Set-Cookie': setCookie });
}

export async function registerVerify(env: Env, request: Request): Promise<Response> {
  const body = await readJson<{ response: RegistrationResponseJSON; label?: string }>(request);
  const ch = await takeChallenge(env, request, 'register');
  const { rpID, origin } = rp(request);
  const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge: ch.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true }).catch(() => undefined);
  if (!result?.verified) throw new HttpError(400, 'passkey_invalid');
  const { credential } = result.registrationInfo;

  const signedIn = await currentUser(env, request);
  let userId = ch.user_id!;
  const stmts = [];
  if (ch.handle) {
    // Nouveau compte : le pseudo a pu être pris entre-temps.
    if (await userByHandle(env.DB, ch.handle)) throw new HttpError(409, 'handle_taken');
    stmts.push(env.DB.prepare('INSERT INTO users (id, handle, name, avatar_url, github_id, created_at) VALUES (?, ?, NULL, NULL, NULL, ?)').bind(userId, ch.handle, nowIso()));
  } else if (!signedIn || signedIn.id !== userId) {
    throw new HttpError(401, 'not_signed_in');
  } else userId = signedIn.id;
  const label = typeof body.label === 'string' ? body.label.slice(0, 60) : null;
  stmts.push(
    env.DB.prepare('INSERT INTO passkeys (id, user_id, public_key, counter, transports, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      credential.id,
      userId,
      isoBase64URL.fromBuffer(credential.publicKey),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      label,
      nowIso(),
    ),
  );
  await env.DB.batch(stmts);
  const headers = new Headers({ 'Set-Cookie': clearChallenge(request) });
  if (!signedIn) headers.append('Set-Cookie', await createSession(env, request, userId));
  return json({ ok: true }, 200, headers);
}

export async function loginOptions(env: Env, request: Request): Promise<Response> {
  const { rpID } = rp(request);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  const setCookie = await saveChallenge(env, request, options.challenge, 'login');
  return json(options, 200, { 'Set-Cookie': setCookie });
}

export async function loginVerify(env: Env, request: Request): Promise<Response> {
  const body = await readJson<{ response: AuthenticationResponseJSON }>(request);
  const ch = await takeChallenge(env, request, 'login');
  const id = String(body.response?.id ?? '');
  const key = await env.DB.prepare('SELECT * FROM passkeys WHERE id = ?').bind(id).first<{ id: string; user_id: string; public_key: string; counter: number; transports: string | null }>();
  if (!key) throw new HttpError(404, 'passkey_unknown');
  const { rpID, origin } = rp(request);
  const result = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: ch.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: { id: key.id, publicKey: isoBase64URL.toBuffer(key.public_key), counter: key.counter, transports: key.transports ? JSON.parse(key.transports) : undefined },
  }).catch(() => undefined);
  if (!result?.verified) throw new HttpError(401, 'passkey_invalid');
  await env.DB.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').bind(result.authenticationInfo.newCounter, nowIso(), key.id).run();
  const headers = new Headers({ 'Set-Cookie': clearChallenge(request) });
  headers.append('Set-Cookie', await createSession(env, request, key.user_id));
  return json({ ok: true }, 200, headers);
}
