// Direct access to World Athletics' own GraphQL backend, using the rotating public x-api-key
// captured daily by scripts/wa-key-refresh.mjs (via .github/workflows/refresh-wa-graphql-key.yml)
// and stored in the WA_GRAPHQL_KV Cloudflare KV binding. Some operations (like
// getCISSingleCompetitor) reject this key as "Not Authorized" - it's apparently scoped to
// whatever the public worldathletics.org frontend itself calls. GetSingleCompetitorResultsDiscipline
// is confirmed to be one of those public operations (captured live from a real page load), and
// unlike the HTML embed on the profile page (which only ever shows the current year, regardless of
// URL query params), this GraphQL query takes an explicit year argument - so it's the fallback
// wa-results.js needs for multi-year results.
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
