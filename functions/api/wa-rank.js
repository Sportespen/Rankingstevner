// World Athletics' own public profile page (read directly, no key needed - see wa-html.js) is now
// the primary source, not a fallback: worldathletics.nimarion.de is a single-maintainer, unofficial
// wrapper around WA's undocumented API with no SLA, and it went down for 24+ hours with no ETA
// once already. It's kept only as a backup for whatever this direct read doesn't cover.
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

// Only tried once the direct read above has already failed.
async function fetchViaProxy(id) {
  const proxyUrl = `https://worldathletics.nimarion.de/athletes/${id}`;
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
    const err = new Error('Proxy-oppslag feilet');
    err.details = { status:res.status, bodyPreview:text.slice(0,300) };
    throw err;
  }
  return {
    ok:true,
    source:'worldathletics.nimarion.de',
    status:res.status,
    id:Number(id),
    name:data ? `${data.firstname || ''} ${data.lastname || ''}`.trim() : null,
    sex:data?.sex ?? null,
    country:data?.country ?? null,
    currentWorldRankings:Array.isArray(data?.currentWorldRankings) ? data.currentWorldRankings : [],
    activeSeasons:Array.isArray(data?.activeSeasons) ? data.activeSeasons : []
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  let directFailure = null;
  try {
    return json(await fetchDirectRank(id));
  } catch (e) {
    directFailure = { error:'Direkte oppslag mot worldathletics.org feilet', detail:String(e?.message || e) };
  }

  try {
    return json(await fetchViaProxy(id));
  } catch (e) {
    return json({
      ok:false,
      source:'worldathletics.org (direkte)',
      ...directFailure,
      proxyFallbackError:String(e?.message || e),
      proxyFallbackDetails:e?.details ?? null
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
