import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
let content = '';
vi.mock('./github', async (orig) => ({
  ...(await orig<typeof import('./github')>()),
  findGist: vi.fn(async () => 'oldgist'),
  deleteGist: vi.fn(async (_t: string, id: string) => void calls.push(`delete ${id}`)),
  createGist: vi.fn(async (_t: string, c: string) => (calls.push('create'), (content = c), 'newgist')),
  updateGist: vi.fn(async (_t: string, id: string, c: string) => (calls.push(`update ${id}`), (content = c))),
}));

const { publishShare, usePublish } = await import('./share');
const { DEFAULT_PROFILE } = await import('./store');

const state = {
  profile: DEFAULT_PROFILE,
  workouts: [{ id: 'w', date: '2026-10-01T17:42:00.000Z', dayName: 'A', finished: true, exercises: [{ exerciseId: 'bench', sets: [{ weight: 60, reps: 8, done: true }] }] }],
  body: [],
  friends: ['alex', 'sam'],
  share: { enabled: true, body: false },
} as never;
const user = { login: 'rokuru', name: 'R', avatarUrl: '' };

describe('publication du partage public', () => {
  beforeEach(() => {
    calls.length = 0;
    usePublish.setState({ gistId: undefined, format: undefined, lastContent: undefined });
  });

  it('recrée une fois le gist d’un ancien format (historique effacé), puis le met à jour', async () => {
    await publishShare('t', state, user);
    expect(calls).toEqual(['delete oldgist', 'create']);
    const p = JSON.parse(content);
    expect(p.friends).toEqual([]);
    expect(p.friendHashes).toHaveLength(2);
    expect(content).not.toContain('alex');
    expect(p.recent[0].date).toBe('2026-10-01');
    expect(content).not.toContain('17:42');
    calls.length = 0;
    await publishShare('t', state, user);
    expect(calls).toEqual([]);
    await publishShare('t', { ...(state as object), friends: ['alex'] } as never, user);
    expect(calls).toEqual(['update newgist']);
  });
});
