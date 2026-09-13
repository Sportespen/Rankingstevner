export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const proxyUrl = `https://worldathletics.nimarion.de/athletes/${id}`;
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
