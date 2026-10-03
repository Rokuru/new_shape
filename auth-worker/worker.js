/**
 * Proxy OAuth GitHub pour New Shape (Cloudflare Worker).
 * Rôles :
 *  - POST /token  : échanger le `code` renvoyé par GitHub contre un jeton d'accès (l'échange nécessite le secret
 *                   de l'application OAuth, qui ne doit jamais être dans le navigateur) ;
 *  - POST /revoke : révoquer le jeton à la déconnexion (lui aussi nécessite le secret).
 *
 * Secret obligatoire : GITHUB_CLIENT_SECRET (dans Settings → Variables and Secrets, type « Secret »).
 * Le Client ID et l'origine sont publics : ils sont écrits ici, aucune autre variable n'est nécessaire.
 */
const CLIENT_ID = 'Ov23liyZi5eEiCRHEjXB';
const ALLOWED_ORIGIN = 'https://rokuru.github.io';
/** Seule adresse de retour acceptée (celle de l'app). */
const ALLOWED_REDIRECT_PREFIX = `${ALLOWED_ORIGIN}/new_shape/`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = origin === ALLOWED_ORIGIN;
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    // Réponses jamais mises en cache (elles peuvent contenir un jeton).
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || (url.pathname !== '/token' && url.pathname !== '/revoke')) return json({ error: 'not_found' }, 404);
    if (!allowed) return json({ error: 'origin_not_allowed' }, 403);
    if ((request.headers.get('Content-Type') || '').split(';')[0].trim() !== 'application/json') return json({ error: 'invalid_content_type' }, 415);
    if (!env.GITHUB_CLIENT_SECRET) return json({ error: 'missing_secret' }, 500);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    if (url.pathname === '/revoke') {
      const token = body && body.access_token;
      if (typeof token !== 'string' || !/^[\w-]{20,255}$/.test(token)) return json({ error: 'invalid_token' }, 400);
      const res = await fetch(`https://api.github.com/applications/${CLIENT_ID}/token`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Basic ${btoa(`${CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
          'Content-Type': 'application/json',
          'User-Agent': 'new-shape-auth',
        },
        body: JSON.stringify({ access_token: token }),
      });
      // 204 : révoqué ; 404 : déjà invalide ou jeton personnel (non géré par l'app OAuth).
      return json({ revoked: res.status === 204 }, res.status === 204 || res.status === 404 ? 200 : 502);
    }

    const code = body && body.code;
    const redirectUri = body && body.redirect_uri;
    if (typeof code !== 'string' || !/^[\w-]{4,100}$/.test(code)) return json({ error: 'invalid_code' }, 400);
    if (typeof redirectUri !== 'string' || !redirectUri.startsWith(ALLOWED_REDIRECT_PREFIX) || redirectUri.length > 200) return json({ error: 'invalid_redirect_uri' }, 400);

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'new-shape-auth' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.access_token) return json({ error: data.error_description || data.error || 'exchange_failed' }, 400);
    return json({ access_token: data.access_token });
  },
};
