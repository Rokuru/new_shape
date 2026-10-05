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
  // Photo de profil : 'upload' (image envoyée, stockée ici), 'preset' (avatar de l'app), 'github', 'none' (initiale).
  `CREATE TABLE IF NOT EXISTS avatars (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    preset TEXT,
    mime TEXT,
    data TEXT,
    updated_at TEXT NOT NULL
  )`,
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

/** Avatars prédéfinis de l'app (fichiers public/avatars/<id>.svg). */
export const AVATAR_PRESETS = Array.from({ length: 16 }, (_, i) => `a${String(i + 1).padStart(2, '0')}`);

export interface AvatarRow {
  kind: 'upload' | 'preset' | 'github' | 'none';
  preset: string | null;
  updated_at: string;
}

export const avatarOf = (db: D1Database, userId: string) => db.prepare('SELECT kind, preset, updated_at FROM avatars WHERE user_id = ?').bind(userId).first<AvatarRow>();

/**
 * Adresse de l'avatar affiché : photo envoyée (servie par l'app, adresse versionnée), avatar prédéfini,
 * photo GitHub (par défaut pour un compte GitHub) ou aucune (initiale).
 */
export function publicUser(u: UserRow, av?: AvatarRow | null): PublicUser {
  const github = u.avatar_url && u.avatar_url.startsWith('https://avatars.githubusercontent.com/') ? u.avatar_url : '';
  let avatarUrl = github;
  if (av?.kind === 'upload') avatarUrl = `/api/avatar/${encodeURIComponent(u.id)}?v=${encodeURIComponent(av.updated_at)}`;
  else if (av?.kind === 'preset' && av.preset && AVATAR_PRESETS.includes(av.preset)) avatarUrl = `/avatars/${av.preset}.svg`;
  else if (av?.kind === 'none') avatarUrl = '';
  return { login: u.handle, name: u.name, avatarUrl, github: u.github_id !== null };
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
