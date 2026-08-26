export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const id = raw.match(/(\d{7,9})/)?.[1];
  if (!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear()-1, now.getUTCFullYear()-2, now.getUTCFullYear()-3];
  const attempts = [];
  const results = [];
  const combined = [];

  const normalizeRecords = value => Array.isArray(value) ? value.map(String) : (value == null ? [] : [String(value)]);

  for (const year of years) {
    const endpoint = `https://worldathletics.nimarion.de/athletes/${id}/results?year=${year}`;
    try {
      const res = await fetch(endpoint, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}
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
          records:normalizeRecords(r.records ?? r.record),
          source:'athlete-results'
        };
        results.push(item);
        if (/decathlon|heptathlon|pentathlon/i.test(discipline)) combined.push(item);
      }
    } catch (e) {
      attempts.push({year,error:String(e?.message || e)});
    }
  }

  const cutoff18 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-18, now.getUTCDate(), 0,0,0));
  const threeYearStart = new Date(Date.UTC(now.getUTCFullYear()-3,0,1,0,0,0));

  function parseDate(v){
    if(!v) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  function isOwChampionship(name){
    const s=String(name||'').toLowerCase();
    return /olympic games|world athletics championships/.test(s);
  }
  function isAreaSeniorOutdoor(name){
    const s=String(name||'').toLowerCase();
    return /european athletics championships|african championships|asian athletics championships|nacac championships|south american championships|oceania area championships/.test(s);
  }
  function combinedType(discipline){
    const d=String(discipline||'').toLowerCase();
    if(d.includes('heptathlon short track') || d.includes('pentathlon short track')) return 'similar';
    if(d==='decathlon' || d==='heptathlon' || d.includes('decathlon ') || (d.includes('heptathlon')&&!d.includes('short track'))) return 'main';
    return null;
  }
  function wrStatus(records){
    const recs=normalizeRecords(records).map(x=>x.toUpperCase().replace(/\s+/g,''));
    if(recs.some(x=>x.includes('=WR') || x.includes('EWR') || x.includes('WR='))) return 'equal';
    if(recs.some(x=>/(^|[^A-Z])WR([^A-Z]|$)/.test(x) || x==='WR')) return 'new';
    return null;
  }
  function wrBonusFor(result){
    const date=parseDate(result.date);
    if(!date || date<cutoff18) return 0;
    const type=combinedType(result.discipline);
    const status=wrStatus(result.records);
    if(!type || !status) return 0;
    if(type==='main') return status==='new'?20:10;
    return status==='new'?10:5;
  }

  const combinedWithDates = combined.map((r,i)=>({...r,_i:i,_date:parseDate(r.date)}));
  const newestOw = combinedWithDates
    .filter(r=>r._date && r._date>=threeYearStart && isOwChampionship(r.competition))
    .sort((a,b)=>b._date-a._date)[0] || null;

  const eligibleCombined = combinedWithDates.filter(r=>{
    if(!r._date) return false;
    if(r._date >= cutoff18) return true;
    if(newestOw && r._i===newestOw._i) return true;
    if(r._date>=threeYearStart && isAreaSeniorOutdoor(r.competition)) return true;
    return false;
  }).map(({_i,_date,...r})=>r);

  const worldRecordPerformances = combined
    .map(r=>({result:r,status:wrStatus(r.records),bonus:wrBonusFor(r)}))
    .filter(x=>x.bonus>0)
    .map(x=>({discipline:x.result.discipline,mark:x.result.mark,date:x.result.date,records:x.result.records,status:x.status,bonus:x.bonus}));
  const worldRecordBonus = worldRecordPerformances.reduce((sum,x)=>sum+x.bonus,0);

  const competitionMap = new Map();
  for (const c of eligibleCombined) {
    const cid = Number(c.competitionId);
    if (Number.isFinite(cid) && cid > 0 && !competitionMap.has(cid)) competitionMap.set(cid,c);
  }

  const enrichedAttempts = [];
  for (const [competitionId, parent] of [...competitionMap.entries()].slice(0,12)) {
    try {
      const res = await fetch(`https://worldathletics.nimarion.de/competitions/${competitionId}/results`, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}
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
              records:normalizeRecords(r.records ?? r.record),
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

  const seen = new Set();
  const deduped = results.filter(r => {
    const key = [r.competitionId||'',r.date||'',String(r.discipline||'').toLowerCase(),r.mark||'',r.place||''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return json({
    ok:true,
    id:Number(id),
    attempts,
    enrichedAttempts,
    results:deduped,
    combined:eligibleCombined,
    worldRecordBonus,
    worldRecordPerformances,
    rankingPeriod:{
      type:'combined-events-2026',
      months:18,
      cutoff:cutoff18.toISOString().slice(0,10),
      championshipExceptionStart:threeYearStart.toISOString().slice(0,10),
      newestOwCompetition:newestOw?.competition ?? null,
      newestOwDate:newestOw?.date ?? null
    }
  });
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
