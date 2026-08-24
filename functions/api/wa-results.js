export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear()-1, now.getUTCFullYear()-2];
  const attempts = [];
  const results = [];
  const combined = [];

  for (const year of years) {
    const endpoint = `https://worldathletics.nimarion.de/athletes/${id}/results?year=${year}`;
    try {
      const res = await fetch(endpoint, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.9.1','Accept':'application/json'}
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      attempts.push({year,status:res.status,count:Array.isArray(data)?data.length:null});
      if (!res.ok || !Array.isArray(data)) continue;

      for (const r of data) {
        const discipline = String(r.discipline || r.event || '').trim();
        if (!discipline) continue;
        const item = {
          year,
          discipline,
          mark:r.mark ?? r.result ?? null,
          resultScore:Number(r.resultScore) || 0,
          place:Number(r.place) || null,
          category:String(r.category || '').toUpperCase(),
          competition:r.competition ?? null,
          competitionId:r.competitionId ?? null,
          date:r.date ?? null,
          legal:r.legal !== false,
          wind:r.wind ?? null
        };
        results.push(item);
        if (/decathlon|heptathlon|pentathlon/i.test(discipline)) combined.push(item);
      }
    } catch (e) {
      attempts.push({year,error:String(e?.message || e)});
    }
  }

  return json({ok:true,id:Number(id),attempts,results,combined});
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
