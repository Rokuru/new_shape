/**
 * Proxy OAuth GitHub pour New Shape (Cloudflare Worker).
 * Son seul rôle : échanger le `code` renvoyé par GitHub contre un jeton d'accès,
 * car cet échange nécessite le secret de l'application OAuth, qui ne doit jamais être dans le navigateur.
 *
 * Variables : GITHUB_CLIENT_ID, ALLOWED_ORIGIN (ex. https://rokuru.github.io)
 * Secret    : GITHUB_CLIENT_SECRET (wrangler secret put GITHUB_CLIENT_SECRET)
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = origin === env.ALLOWED_ORIGIN;
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/token') return json({ error: 'not_found' }, 404);
    if (!allowed) return json({ error: 'origin_not_allowed' }, 403);

    let code;
    let redirectUri;
    try {
      ({ code, redirect_uri: redirectUri } = await request.json());
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    if (typeof code !== 'string' || !/^[\w-]{4,100}$/.test(code)) return json({ error: 'invalid_code' }, 400);

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'new-shape-auth' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.access_token) return json({ error: data.error_description || data.error || 'exchange_failed' }, 400);
    return json({ access_token: data.access_token });
  },
};
