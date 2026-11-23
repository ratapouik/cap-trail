// Relais Strava pour l'appli Cap Trail — Cloudflare Worker (format module)
//
// Rôle : garder la clé secrète Strava hors de la page publique.
//   POST /token    {code}           -> échange le code OAuth contre des jetons
//   POST /refresh  {refresh_token}  -> renouvelle le jeton d'accès (valable 6 h)
//   GET  /api/...                   -> relaie la requête vers https://www.strava.com/api/v3/...
//
// Variables à définir dans Cloudflare (Settings > Variables and Secrets) :
//   STRAVA_CLIENT_ID       identifiant de l'application Strava
//   STRAVA_CLIENT_SECRET   clé secrète (à déclarer en « Secret »)
//   ALLOWED_ORIGIN         facultatif, par défaut https://ratapouik.github.io
//                          (plusieurs origines possibles, séparées par des virgules)

const DEFAULT_ORIGIN = 'https://ratapouik.github.io';

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    if (url.pathname === '/' && req.method === 'GET') {
      return json({ message: 'Relais Strava Cap Trail opérationnel', configure: !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET) }, 200, cors);
    }
    if (!okOrigin) return json({ message: 'Origine non autorisée : ' + (origin || 'aucune') }, 403, cors);
    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
      return json({ message: 'Relais non configuré : STRAVA_CLIENT_ID ou STRAVA_CLIENT_SECRET manquant' }, 500, cors);
    }

    try {
      // Jetons OAuth
      if (url.pathname === '/token' || url.pathname === '/refresh') {
        if (req.method !== 'POST') return json({ message: 'Méthode POST attendue' }, 405, cors);
        const body = await req.json().catch(() => ({}));
        const params = { client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET };
        if (url.pathname === '/token') {
          if (!body.code) return json({ message: 'Code OAuth manquant' }, 400, cors);
          params.code = body.code;
          params.grant_type = 'authorization_code';
        } else {
          if (!body.refresh_token) return json({ message: 'Jeton de rafraîchissement manquant' }, 400, cors);
          params.refresh_token = body.refresh_token;
          params.grant_type = 'refresh_token';
        }
        const r = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const j = await r.json().catch(() => ({}));
        const out = r.ok
          ? {
              access_token: j.access_token,
              refresh_token: j.refresh_token,
              expires_at: j.expires_at,
              athlete: j.athlete ? { id: j.athlete.id, firstname: j.athlete.firstname } : undefined,
            }
          : { message: j.message || 'Erreur Strava', errors: j.errors };
        return json(out, r.status, cors);
      }

      // Lecture de l'API Strava (lecture seule, chemins limités)
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET') return json({ message: 'Lecture seule' }, 405, cors);
        const path = url.pathname.slice(4);
        if (!/^\/(athlete|athlete\/.+|activities\/\d+(\/.*)?)$/.test(path)) {
          return json({ message: 'Chemin non autorisé' }, 404, cors);
        }
        const r = await fetch('https://www.strava.com/api/v3' + path + url.search, {
          headers: { Authorization: req.headers.get('Authorization') || '' },
        });
        return new Response(r.body, {
          status: r.status,
          headers: { ...cors, 'Content-Type': r.headers.get('Content-Type') || 'application/json' },
        });
      }

      return json({ message: 'Route inconnue' }, 404, cors);
    } catch (e) {
      return json({ message: 'Erreur du relais : ' + e.message }, 502, cors);
    }
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}
