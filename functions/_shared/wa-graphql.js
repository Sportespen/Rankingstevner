// Direct access to World Athletics' own GraphQL backend, used as a fallback when
// worldathletics.nimarion.de (an unmaintained, single-developer proxy) is down. This is the same
// backend nimarion.de itself calls under the hood - we just capture our own rotating x-api-key
// instead of depending on his server being up. The key is refreshed daily by
// scripts/wa-key-refresh.mjs (via .github/workflows/refresh-wa-graphql-key.yml, a Playwright job
// that sniffs a real browser's own network traffic, exactly like nimarion's own key-updater does)
// and stored in the WA_GRAPHQL_KV Cloudflare KV binding.
const KV_KEY = 'wa_graphql_config';

export async function waGraphQL(env, query, variables, extraHeaders = {}) {
  const kv = env.WA_GRAPHQL_KV;
  if (!kv) throw new Error('WA_GRAPHQL_KV-bindingen mangler');
  const raw = await kv.get(KV_KEY);
  if (!raw) throw new Error('Ingen WA GraphQL-nøkkel lagret i KV ennå');
  let config = null;
  try { config = JSON.parse(raw); } catch (_) {}
  if (!config?.apiKey || !config?.endpoint) throw new Error('Ufullstendig WA GraphQL-konfigurasjon i KV');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  let res;
  try {
    res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-graphql-client-name': 'worldathletics',
        'x-api-key': config.apiKey,
        ...extraHeaders,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch (_) {}
  if (!res.ok) throw new Error(`WA GraphQL svarte ${res.status}: ${text.slice(0, 200)}`);
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(payload.errors[0]?.message || 'WA GraphQL-feil');
  }
  return payload?.data;
}

export function cleanupDiscipline(raw) {
  return String(raw || '')
    .replace(/^(Women's |Men's |Mixed )/, '')
    .replace(/ sh$/i, '')
    .replace(/Short Track/i, '')
    .trim();
}

export function formatSex(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (['men', 'male', 'man', 'm'].includes(s)) return 'M';
  if (['women', 'female', 'woman', 'w'].includes(s)) return 'W';
  return null;
}

export function parsePlace(raw) {
  if (raw === 'OC') return -1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : -1;
}
