/** Types minimaux de Cloudflare D1 (évite une dépendance de types pour quelques méthodes). */
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface Env {
  DB: D1Database;
  /** Application OAuth GitHub (Client ID public, secret dans les « secrets » du projet). */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export interface UserRow {
  id: string;
  handle: string;
  name: string | null;
  avatar_url: string | null;
  github_id: number | null;
  created_at: string;
}

/** Utilisateur tel qu'exposé à l'app (jamais d'identifiant interne ni de données techniques). */
export interface PublicUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  /** Compte relié à GitHub : le pseudo est celui, vérifié, du compte GitHub. */
  github: boolean;
}
