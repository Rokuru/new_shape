import { describe, expect, it } from 'vitest';
import { explainOAuthError } from './github';

describe('erreurs OAuth', () => {
  it('traduit les erreurs de configuration du Worker', () => {
    expect(explainOAuthError('Not Found')).toContain('Client ID');
    expect(explainOAuthError('The client_id and/or client_secret passed are incorrect.')).toContain('secret');
    expect(explainOAuthError('missing_secret')).toContain('GITHUB_CLIENT_SECRET');
    expect(explainOAuthError('autre')).toBe('autre');
  });
});
