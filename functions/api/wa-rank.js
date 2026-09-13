import { waGraphQL, formatSex } from '../_shared/wa-graphql.js';

// Confirmed live: worldathletics.nimarion.de (the third-party service this endpoint used to
// depend on exclusively) can go down for well over a day with no ETA and no way to reach its
// maintainer. Tried first, unchanged, so a normal healthy day behaves exactly as before; only on
// failure do we fall back to querying World Athletics' own GraphQL backend directly (see
// ../_shared/wa-graphql.js for why that needs a separately-refreshed credential rather than being
// the default path).
const DIRECT_QUERY = `
  query getSingleCompetitor($id: Int) {
    getSingleCompetitor(id: $id) {
      basicData { givenName familyName countryCode sexNameUrlSlug }
      seasonsBests { activeSeasons }
      worldRankings { current { eventGroup place } }
    }
  }
`;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const proxyUrl = `https://worldathletics.nimarion.de/athletes/${id}`;
  let proxyError = null;
  try {
    const res = await fetch(proxyUrl, {
      headers: {
        'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.9',
        'Accept':'application/json'
      }
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    if (!res.ok) {
      proxyError = {status:res.status,bodyPreview:text.slice(0,300)};
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
    proxyError = {error:String(e?.message || e)};
  }

  try {
    const data = await waGraphQL(context.env, DIRECT_QUERY, {id:Number(id)});
    const c = data?.getSingleCompetitor;
    if (!c) throw new Error('Tomt svar fra World Athletics');
    return json({
      ok:true,
      source:'worldathletics-direct',
      id:Number(id),
      name:`${c.basicData?.givenName || ''} ${c.basicData?.familyName || ''}`.trim(),
      sex:formatSex(c.basicData?.sexNameUrlSlug),
      country:c.basicData?.countryCode ?? null,
      currentWorldRankings:Array.isArray(c.worldRankings?.current) ? c.worldRankings.current : [],
      activeSeasons:Array.isArray(c.seasonsBests?.activeSeasons) ? c.seasonsBests.activeSeasons : []
    });
  } catch (directError) {
    return json({
      ok:false,
      source:'worldathletics.nimarion.de',
      ...proxyError,
      error:proxyError?.bodyPreview ? 'Proxy-oppslag feilet' : (proxyError?.error || 'Kunne ikke kontakte proxyen'),
      directFallbackError:String(directError?.message || directError)
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
