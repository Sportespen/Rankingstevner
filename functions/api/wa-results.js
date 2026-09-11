// Nothing here bounded how long a single external call could take, and the year-by-year and
// competition-by-competition lookups below ran one after another instead of at the same time -
// with up to 4 sequential athlete/results fetches followed by up to 12 MORE sequential
// competition/results fetches, this was the dominant source of latency after picking an athlete
// and event (far more than the ranking-score lookup in wa-official-ranking.js). Both loops now
// fire concurrently via Promise.all, and every fetch has a hard deadline so one slow call can't
// stall the whole response.
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

  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear()-1, now.getUTCFullYear()-2, now.getUTCFullYear()-3];
  const attempts = [];
  const results = [];
  const combined = [];

  const normalizeRecords = value => Array.isArray(value) ? value.map(String) : (value == null ? [] : [String(value)]);

  await Promise.all(years.map(async year => {
    const endpoint = `https://worldathletics.nimarion.de/athletes/${id}/results?year=${year}`;
    try {
      const res = await fetchWithTimeout(endpoint, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      attempts.push({year,status:res.status,count:Array.isArray(data)?data.length:null});
      if (!res.ok || !Array.isArray(data)) return;

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
  }));

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

  // Confirmed live (Jonathan Hertwig-Ødegaard, 400m, "Dinamo Zrinjevac"): when a competition splits
  // a race into multiple heats with no separate final, this API's per-athlete endpoint reports
  // "place" relative to the athlete's OWN heat only (he won heat 1 -> place:1), not the true
  // placing across the full field (7th once both heats are merged and sorted by mark) - and a
  // Placing Score built on that heat-only place badly overstates it (28 points for a 1st, when the
  // real, sammenlagt 7th place is worth 12). The full competition-results endpoint below already
  // gets fetched for combined-event sub-events; the same fetch also carries every heat's full
  // field for ordinary individual events, so it's reused here to recompute a real overall place
  // for those too - not a guess, just the sort the per-athlete endpoint itself never did.
  const individualCompetitionIds = new Map();
  for (const r of results) {
    if (r.source !== 'athlete-results' || /decathlon|heptathlon|pentathlon/i.test(r.discipline)) continue;
    const d = parseDate(r.date);
    if (!d || d < cutoff18) continue;
    const cid = Number(r.competitionId);
    if (!Number.isFinite(cid) || cid <= 0 || competitionMap.has(cid)) continue;
    const existing = individualCompetitionIds.get(cid);
    if (!existing || d > existing) individualCompetitionIds.set(cid, d);
  }
  // Combined-parent competitions are already known to matter (they feed the combined-event score
  // directly); individual-only competitions are ordered most-recent-first so a capped fetch budget
  // still covers the meets most likely to affect the athlete's CURRENT Ranking Score first.
  const individualOnlyIds = [...individualCompetitionIds.entries()].sort((a,b) => b[1] - a[1]).map(([cid]) => cid);
  const COMPETITION_FETCH_CAP = 20;
  const orderedCompetitionIds = [...competitionMap.keys(), ...individualOnlyIds].slice(0, COMPETITION_FETCH_CAP);

  const enrichedAttempts = [];
  await Promise.all(orderedCompetitionIds.map(async (competitionId) => {
    const parent = competitionMap.get(competitionId) || null;
    try {
      const res = await fetchWithTimeout(`https://worldathletics.nimarion.de/competitions/${competitionId}/results`, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      enrichedAttempts.push({competitionId,status:res.status,events:Array.isArray(data?.events)?data.events.length:null});
      if (!res.ok || !Array.isArray(data?.events)) return;

      if (parent) {
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
      }

      // Recompute a real overall place for this athlete's own ordinary (non-combined) results at
      // this competition, by merging every heat/section of the matching event and sorting on mark -
      // the same math a full results page (or WA's own ranking calculation, when it works from
      // complete data) would use, not an independent guess.
      for (const item of results) {
        if (item.source !== 'athlete-results') continue;
        if (Number(item.competitionId) !== competitionId) continue;
        if (/decathlon|heptathlon|pentathlon/i.test(item.discipline)) continue;
        const wantedDiscipline = String(item.discipline||'').trim().toLowerCase();
        const event = data.events.find(ev =>
          String(ev?.discipline||'').trim().toLowerCase() === wantedDiscipline &&
          (ev.races||[]).some(race => (race.results||[]).some(r => (r.athletes||[]).some(a => String(a?.id) === String(id))))
        );
        if (!event) continue;
        const allRows = (event.races||[]).flatMap(race => race.results||[]);
        const valid = allRows.filter(r => Number.isFinite(r?.performanceValue) && r.performanceValue > 0);
        if (valid.length < 2) continue; // nothing to merge - a single heat's own place was already right
        const sorted = valid.slice().sort((a,b) => event.isTechnical ? b.performanceValue - a.performanceValue : a.performanceValue - b.performanceValue);
        const idx = sorted.findIndex(r => (r.athletes||[]).some(a => String(a?.id) === String(id)));
        if (idx !== -1 && idx + 1 !== item.place) { item.place = idx + 1; item.placeCorrected = true; }
      }
    } catch (e) {
      enrichedAttempts.push({competitionId,error:String(e?.message || e)});
    }
  }));

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
