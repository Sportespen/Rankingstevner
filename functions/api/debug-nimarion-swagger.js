// TEMPORARY diagnostic, not wired into any UI - visit this URL directly on the deployed site.
// worldathletics.nimarion.de (the proxy this app already uses for the calendar/results/organiser
// data, see functions/api/meet-search.js, meet-history.js, meet-details.js) publishes a Swagger
// UI at /swagger (confirmed via web search) - but this dev sandbox has no network access to
// worldathletics.nimarion.de to read the spec itself, only the DEPLOYED function does. Fetches
// the raw OpenAPI spec instead of guessing endpoint names/shapes, to check whether it exposes a
// per-competition schedule/entry-list for FUTURE meets - the general calendar feed's own
// discipline tag turned out to be too coarse ("Track and Field") to filter Stevnefinner by a
// specific individual event without risking a false match.
export async function onRequestGet(context) {
  const candidates = [
    'https://worldathletics.nimarion.de/swagger-json',
    'https://worldathletics.nimarion.de/swagger.json',
    'https://worldathletics.nimarion.de/api-json',
    'https://worldathletics.nimarion.de/openapi.json',
  ];
  const attempts = [];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Rankingstevner/1.0' } });
      if (!r.ok) { attempts.push({ url, status: r.status }); continue; }
      let data;
      try { data = await r.json(); } catch (e) { attempts.push({ url, status: r.status, parseError: String(e?.message || e) }); continue; }
      const paths = data?.paths
        ? Object.entries(data.paths).map(([path, methods]) => ({
            path,
            methods: Object.entries(methods || {}).map(([m, def]) => ({
              method: m,
              summary: def?.summary || def?.operationId || null,
              parameters: Array.isArray(def?.parameters) ? def.parameters.map(p => p?.name).filter(Boolean) : [],
            })),
          }))
        : null;
      return json({ ok: true, source: url, pathCount: paths?.length ?? null, paths, topLevelKeys: Object.keys(data || {}) });
    } catch (e) {
      attempts.push({ url, error: String(e?.message || e) });
    }
  }
  return json({ ok: false, reason: 'no-swagger-spec-found', attempts });
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
