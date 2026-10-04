// Base D1 simulée pour les tests : SQLite en mémoire (node:sqlite), même API que Cloudflare D1.
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../types';

export function memoryD1(): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const prepare = (query: string, params: unknown[] = []): D1PreparedStatement & { exec(): { changes: number } } => {
    const args = () => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p)) as never[];
    return {
      bind: (...values: unknown[]) => prepare(query, values),
      first: async <T>() => ((raw.prepare(query).get(...args()) as T | undefined) ?? null),
      all: async <T>() => ({ results: raw.prepare(query).all(...args()) as T[], success: true, meta: {} }),
      run: async () => ({ results: [], success: true, meta: { changes: Number(raw.prepare(query).run(...args()).changes) } }),
      exec: () => ({ changes: Number(raw.prepare(query).run(...args()).changes) }),
    };
  };
  return {
    raw,
    prepare: (q) => prepare(q),
    batch: async (stmts) => {
      raw.exec('BEGIN');
      try {
        const out = stmts.map((s) => ({ results: [], success: true, meta: { changes: (s as ReturnType<typeof prepare>).exec().changes } }));
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
