// Confirmed live: when worldathletics.nimarion.de is unreachable, it doesn't always fail fast
// with an error status - sometimes the connection just hangs with no response at all. Without a
// deadline, that left the plain `fetch()` below waiting until Cloudflare's own platform-level
// execution limit killed the whole Worker. wa-results.js already had this protection; this file
// didn't, so it's added here too.
//
// Separately - and this was the actual cause of the "Bad gateway / Host Error" page visitors saw -
// Cloudflare's edge intercepts specific status codes (502 among them) coming back from a Pages
// Function and silently replaces the body with its own generic error page, instead of passing our
// own {ok:false} JSON through to the browser. wa-results.js never hit this because it always
// answers with plain 200 and lets the JSON body's `ok` field carry the failure - the frontend
// already reads that field, not the HTTP status (see athlete-profile.js). So every response below
// now uses 200, even the failure cases.
import { fetchCompetitorFromHtml } from '../_shared/wa-html.js';

const FETCH_TIMEOUT_MS = 6000;
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Only tried once the proxy has already failed - if nimarion.de is up and healthy this never
// runs, so it can't regress the common case. Confirmed live via a one-off Playwright capture
// (scripts/wa-graphql-capture.mjs) - see wa-html.js for why this reads the plain, public profile
// HTML instead of calling WA's GraphQL backend directly (no key, no authorization needed at all).
async function fetchDirectRank(id) {
  const c = await fetchCompetitorFromHtml(id);
  const basic = c.basicData || {};
  return {
    ok: true,
    source: 'worldathletics.org (direkte)',
    id: Number(id),
    name: `${basic.givenName || ''} ${basic.familyName || ''}`.trim() || null,
    sex: basic.male === true ? 'M' : (basic.male === false ? 'W' : null),
    country: basic.countryCode ?? null,
    currentWorldRankings: Array.isArray(c.worldRankings?.current) ? c.worldRankings.current : [],
    activeSeasons: []
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const proxyUrl = `https://worldathletics.nimarion.de/athletes/${id}`;
  let proxyFailure = null;
  try {
    const res = await fetchWithTimeout(proxyUrl, {
      headers: {
        'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.9',
        'Accept':'application/json'
      }
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    if (!res.ok) {
      proxyFailure = { status:res.status, error:'Proxy-oppslag feilet', bodyPreview:text.slice(0,300) };
    } else {
      return json({
        ok:true,
        source:'worldathletics.nimarion.de',
        status:res.status,
        id:Number(id),
        name:data ? `${data.firstname || ''} ${data.lastname || ''}`.trim() : null,
        sex:data?.sex ?? null,
        country:data?.country ?? null,
        currentWorldRankings:Array.isArray(data?.currentWorldRankings) ? data.currentWorldRankings : [],
        activeSeasons:Array.isArray(data?.activeSeasons) ? data.activeSeasons : []
      });
    }
  } catch (e) {
    proxyFailure = { error:'Kunne ikke kontakte proxyen', detail:String(e?.message || e) };
  }

  try {
    return json(await fetchDirectRank(id));
  } catch (e) {
    return json({
      ok:false,
      source:'worldathletics.nimarion.de',
      ...proxyFailure,
      directFallbackError:String(e?.message || e)
    });
  }
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store'
    }
  });
}
