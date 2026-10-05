import type { D1Database, PublicUser, UserRow } from './types';

/**
 * Schéma de la base. Créé automatiquement au premier appel (CREATE … IF NOT EXISTS) :
 * rien à exécuter à la main après avoir relié la base au projet.
 */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT,
    avatar_url TEXT,
    github_id INTEGER UNIQUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    label TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys(user_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    kind TEXT NOT NULL,
    user_id TEXT,
    handle TEXT,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS imports (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS shares (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS follows (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_handle TEXT NOT NULL COLLATE NOCASE,
    PRIMARY KEY (user_id, friend_handle)
  )`,
  `CREATE INDEX IF NOT EXISTS follows_friend ON follows(friend_handle)`,
];

const ready = new WeakSet<D1Database>();

export async function ensureSchema(db: D1Database) {
  if (ready.has(db)) return;
  await db.batch(SCHEMA.map((q) => db.prepare(q)));
  ready.add(db);
}

export const nowIso = () => new Date().toISOString();

/** Pseudo : 3 à 39 caractères, lettres, chiffres et tirets (comme GitHub), sans tiret au début ni à la fin. */
export const HANDLE_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){2,38}$/i;
/** Pseudo GitHub (1 caractère minimum). */
export const GITHUB_LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function publicUser(u: UserRow): PublicUser {
  const avatar = u.avatar_url && u.avatar_url.startsWith('https://avatars.githubusercontent.com/') ? u.avatar_url : '';
  return { login: u.handle, name: u.name, avatarUrl: avatar, github: u.github_id !== null };
}

export const userById = (db: D1Database, id: string) => db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
export const userByHandle = (db: D1Database, handle: string) => db.prepare('SELECT * FROM users WHERE handle = ?').bind(handle).first<UserRow>();
export const userByGithub = (db: D1Database, githubId: number) => db.prepare('SELECT * FROM users WHERE github_id = ?').bind(githubId).first<UserRow>();

/** Identifiant aléatoire (128 bits) en base64url. */
export function randomId(bytes = 16): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
