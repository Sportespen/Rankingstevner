export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ok:true,results:[]});

  try {
    const endpoint = `https://worldathletics.nimarion.de/athletes/search?name=${encodeURIComponent(q)}`;
    const res = await fetch(endpoint, {
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.8.1','Accept':'application/json'}
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!res.ok || !Array.isArray(data)) {
      return json({ok:false,error:'Navnesøk mot World Athletics feilet',status:res.status},502);
    }

    const results = data.slice(0,12).map(a => ({
      id: Number(a.id ?? a.aaAthleteId ?? a.athleteId),
      firstName: a.firstname ?? a.firstName ?? a.givenName ?? '',
      lastName: a.lastname ?? a.lastName ?? a.familyName ?? '',
      country: a.country ?? a.countryCode ?? '',
      sex: a.sex ?? a.gender ?? null,
      birthDate: a.birthDate ?? a.dateOfBirth ?? null,
      disciplines: Array.isArray(a.disciplines) ? a.disciplines : []
    })).filter(a => Number.isFinite(a.id));

    return json({ok:true,results});
  } catch (e) {
    return json({ok:false,error:'Kunne ikke søke etter utøver',detail:String(e?.message || e)},502);
  }
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
