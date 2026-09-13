// Direct access to World Athletics' own internal GraphQL API - the exact same backend
// worldathletics.org's own frontend calls, and the same one worldathletics.nimarion.de (the
// third-party service every athlete lookup in this app used to depend on exclusively) is itself
// built on top of. WA has no public API of its own; the endpoint URL and its access key rotate
// and only ever appear in real browser network traffic, so they can't just be hardcoded here -
// scripts/wa-key-refresh.mjs captures a fresh one daily (via GitHub Actions) and stores it in
// Cloudflare KV, and this file only ever needs to read that.
//
// Exists specifically so a nimarion.de outage (confirmed live: lasting well over a day, with no
// ETA and no way to reach the maintainer) can no longer take down athlete lookups here - callers
// should treat this as a fallback path, tried only after the existing nimarion.de call fails, so
// a normal day where nimarion.de is healthy is completely unaffected by anything below.
export async function waGraphQL(env, query, variables, extraHeaders) {
  const kv = env?.WA_GRAPHQL_KV;
  if (!kv) throw new Error('WA_GRAPHQL_KV binding missing');
  const config = await kv.get('wa_graphql_config', 'json');
  if (!config?.endpoint || !config?.apiKey) throw new Error('No World Athletics GraphQL credentials stored yet');
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-graphql-client-name': 'worldathletics',
      'x-api-key': config.apiKey,
      ...extraHeaders,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) {}
  if (!res.ok || body?.errors?.length) {
    throw new Error(`WA GraphQL ${res.status}: ${body?.errors?.[0]?.message || text.slice(0, 200)}`);
  }
  return body?.data;
}

// Raw WA discipline names come back as "Men's 400 Metres" / "Women's 400 Metres" / "Mixed ... " -
// worldathletics.nimarion.de already strips this prefix server-side before handing us JSON (so
// our existing discipline-matching code everywhere else compares against the stripped form, e.g.
// "400 Metres") - replicated exactly (from nimarion's own open-source cleanupDiscipline()) so a
// direct query returns text in the same shape the rest of this codebase already expects.
export function cleanupDiscipline(discipline) {
  return String(discipline || '')
    .replace("Women's ", '')
    .replace("Men's ", '')
    .replace('Mixed ', '')
    .replace(' sh', '')
    .replace('Short Track', '')
    .trim();
}

// Raw WA sex values seen in the wild: men/male/man/m, women/female/woman/w (any case) - matches
// nimarion's own formatSex() so a direct query maps to the same 'M'/'W' this app uses everywhere.
export function formatSex(input) {
  const s = String(input || '').trim().toLowerCase();
  if (['men', 'male', 'man', 'm'].includes(s)) return 'M';
  if (['women', 'female', 'woman', 'w'].includes(s)) return 'W';
  return null;
}

// WA's own "place" field can be a real place number, the string "OC" (out of competition,
// meaningless for placing purposes), or occasionally something else non-numeric - matches
// nimarion's own PlaceSchema (-1 for anything that isn't a plain positive number).
export function parsePlace(value) {
  if (value === 'OC') return -1;
  const n = Number(value);
  return Number.isFinite(n) ? n : -1;
}
