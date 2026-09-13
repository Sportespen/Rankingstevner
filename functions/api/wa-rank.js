// Confirmed live: when worldathletics.nimarion.de is unreachable, it doesn't always fail fast
// with an error status - sometimes the connection just hangs with no response at all. Without a
// deadline, that left the plain `fetch()` below waiting until Cloudflare's own platform-level
// execution limit killed the whole Worker, which surfaces to the visitor as Cloudflare's own
// "Bad gateway / Host Error" page instead of this file ever getting the chance to return its own,
// honest {ok:false} response - and no amount of changing the code AROUND that fetch call (its own
// try/catch already handles a fast failure correctly) can fix a request that never resolves in the
// first place. wa-results.js already had this exact protection; this file never did.
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

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const proxyUrl = `https://worldathletics.nimarion.de/athletes/${id}`;
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
      return json({
        ok:false,
        source:'worldathletics.nimarion.de',
        status:res.status,
        error:'Proxy-oppslag feilet',
        bodyPreview:text.slice(0,300)
      },502);
    }

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
  } catch (e) {
    return json({
      ok:false,
      source:'worldathletics.nimarion.de',
      error:'Kunne ikke kontakte proxyen',
      detail:String(e?.message || e)
    },502);
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
