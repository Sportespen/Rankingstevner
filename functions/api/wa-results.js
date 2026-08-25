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
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.1','Accept':'application/json'}
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
          wind:r.wind ?? null,
          source:'athlete-results'
        };
        results.push(item);
        if (/decathlon|heptathlon|pentathlon/i.test(discipline)) combined.push(item);
      }
    } catch (e) {
      attempts.push({year,error:String(e?.message || e)});
    }
  }

  // WA sin vanlige utøver-resultatliste viser ofte bare totalsummen fra mangekamp.
  // Hent derfor konkurranseresultatene for mangekampene og ta med deløvelsene
  // (800 m, kule, spyd osv.) for den samme utøveren.
  const competitionMap = new Map();
  for (const c of combined) {
    const cid = Number(c.competitionId);
    if (Number.isFinite(cid) && cid > 0 && !competitionMap.has(cid)) competitionMap.set(cid,c);
  }

  const enrichedAttempts = [];
  for (const [competitionId, parent] of [...competitionMap.entries()].slice(0,12)) {
    try {
      const res = await fetch(`https://worldathletics.nimarion.de/competitions/${competitionId}/results`, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.1','Accept':'application/json'}
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      enrichedAttempts.push({competitionId,status:res.status,events:Array.isArray(data?.events)?data.events.length:null});
      if (!res.ok || !Array.isArray(data?.events)) continue;

      for (const event of data.events) {
        const discipline = String(event?.discipline || event?.name || '').trim();
        if (!discipline || /decathlon|heptathlon|pentathlon/i.test(discipline)) continue;
        const category = String(event?.category || parent.category || '').toUpperCase();
        for (const race of (event?.races || [])) {
          for (const r of (race?.results || [])) {
            const athletes = Array.isArray(r?.athletes) ? r.athletes : [];
            if (!athletes.some(a => String(a?.id) === String(id))) continue;
            const item = {
              year: parent.year,
              discipline,
              mark:r.mark ?? null,
              resultScore:0,
              place:Number(r.place) || null,
              category,
              competition:parent.competition ?? null,
              competitionId,
              date:r.date ?? race?.date ?? parent.date ?? null,
              legal:true,
              wind:r.wind ?? null,
              source:'combined-event-subevent'
            };
            if (item.mark != null) results.push(item);
          }
        }
      }
    } catch (e) {
      enrichedAttempts.push({competitionId,error:String(e?.message || e)});
    }
  }

  // Fjern dubletter som kan komme både fra utøverlisten og konkurransedetaljene.
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = [r.competitionId||'',r.date||'',String(r.discipline||'').toLowerCase(),r.mark||'',r.place||''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return json({ok:true,id:Number(id),attempts,enrichedAttempts,results:deduped,combined});
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
