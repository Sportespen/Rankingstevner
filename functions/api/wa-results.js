// Nothing here bounded how long a single external call could take, and the year-by-year and
// competition-by-competition lookups below ran one after another instead of at the same time -
// with up to 4 sequential athlete/results fetches followed by up to 12 MORE sequential
// competition/results fetches, this was the dominant source of latency after picking an athlete
// and event (far more than the ranking-score lookup in wa-official-ranking.js). Both loops now
// fire concurrently via Promise.all, and every fetch has a hard deadline so one slow call can't
// stall the whole response.
import { waGraphQL } from '../_shared/wa-graphql.js';

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

// Confirmed live against the captured key/endpoint in Cloudflare KV - this is the exact operation
// the real, public worldathletics.org athlete page calls for its own per-year results tab (unlike
// getCISSingleCompetitor, which the same key gets rejected for). Only tried once the proxy has
// already failed for that year, so it can't regress the common case. Returns a flat array shaped
// like nimarion's own per-year result items, so it plugs into the same processing loop below.
const RESULTS_QUERY = `query GetSingleCompetitorResultsDiscipline($id: Int, $resultsByYearOrderBy: String, $resultsByYear: Int) {
  getSingleCompetitorResultsDiscipline(id: $id, resultsByYear: $resultsByYear, resultsByYearOrderBy: $resultsByYearOrderBy) {
    resultsByEvent {
      discipline
      results { date competition place mark wind notLegal resultScore category competitionId eventId }
    }
  }
}`;
// Same pattern for the one piece that was still nimarion-only: breaking a combined event down
// into its individual legs needs the FULL competition's results (all events, all athletes), not
// just this athlete's own per-year list. getCalendarCompetitionResults is the real backend's
// equivalent (found via the same introspection technique as the queries above) - competitor.id
// is a String, so athlete IDs are compared as strings on both sides.
const COMPETITION_RESULTS_QUERY = `query GetCalendarCompetitionResults($competitionId: Int) {
  getCalendarCompetitionResults(competitionId: $competitionId) {
    eventTitles {
      events {
        event
        races {
          date
          results { place mark wind records competitor { id iaafId } }
        }
      }
    }
  }
}`;
async function fetchDirectCompetitionResults(env, competitionId, athleteId) {
  const data = await waGraphQL(env, COMPETITION_RESULTS_QUERY, { competitionId: Number(competitionId) });
  const eventTitles = data?.getCalendarCompetitionResults?.eventTitles;
  if (!Array.isArray(eventTitles)) throw new Error('Ingen konkurranseresultater i svaret');
  const flat = [];
  for (const title of eventTitles) {
    for (const ev of (title?.events || [])) {
      // Unlike the athlete-results and per-year GraphQL endpoints, this one's discipline names
      // carry a "Men's "/"Women's " prefix (e.g. "Men's 100 Metres") - strip it so these rows
      // match the naming convention every other result in this file already uses.
      const discipline = String(ev?.event || '').replace(/^(Women's |Men's |Mixed )/, '').trim();
      if (!discipline || /decathlon|heptathlon|pentathlon/i.test(discipline)) continue;
      for (const race of (ev?.races || [])) {
        for (const r of (race?.results || [])) {
          const c = r?.competitor;
          const matches = c && (String(c.id) === String(athleteId) || String(c.iaafId) === String(athleteId));
          if (!matches || r.mark == null) continue;
          flat.push({ discipline, mark: r.mark, place: r.place, wind: r.wind, records: r.records || null, date: race?.date ?? null });
        }
      }
    }
  }
  return flat;
}

async function fetchDirectYearResults(env, id, year) {
  const data = await waGraphQL(env, RESULTS_QUERY, { id: Number(id), resultsByYear: year, resultsByYearOrderBy: 'discipline' });
  const events = data?.getSingleCompetitorResultsDiscipline?.resultsByEvent;
  if (!Array.isArray(events)) throw new Error('Ingen resultater i svaret');
  const flat = [];
  for (const ev of events) {
    for (const r of (ev?.results || [])) {
      flat.push({
        discipline: ev?.discipline,
        mark: r.mark,
        resultScore: r.resultScore,
        place: r.place,
        category: r.category,
        competition: r.competition,
        competitionId: r.competitionId,
        date: r.date,
        legal: r.notLegal !== true,
        wind: r.wind,
      });
    }
  }
  return flat;
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
    let data = null;
    const attemptInfo = { year };
    try {
      const res = await fetchWithTimeout(endpoint, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}
      });
      const text = await res.text();
      try { data = JSON.parse(text); } catch (_) {}
      attemptInfo.status = res.status;
      attemptInfo.count = Array.isArray(data) ? data.length : null;
      if (!res.ok || !Array.isArray(data)) data = null;
    } catch (e) {
      attemptInfo.error = String(e?.message || e);
    }

    if (!data) {
      try {
        data = await fetchDirectYearResults(context.env, id, year);
        attemptInfo.fallback = 'worldathletics.org (direkte)';
        attemptInfo.fallbackCount = data.length;
      } catch (e) {
        attemptInfo.fallbackError = String(e?.message || e);
      }
    }

    attempts.push(attemptInfo);
    if (!Array.isArray(data)) return;

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

  const enrichedAttempts = [];
  await Promise.all([...competitionMap.entries()].slice(0,12).map(async ([competitionId, parent]) => {
    let events = null;
    const attemptInfo = { competitionId };
    try {
      const res = await fetchWithTimeout(`https://worldathletics.nimarion.de/competitions/${competitionId}/results`, {
        headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      attemptInfo.status = res.status;
      attemptInfo.events = Array.isArray(data?.events) ? data.events.length : null;
      if (res.ok && Array.isArray(data?.events)) {
        events = data.events.map(event => ({
          discipline: String(event?.discipline || event?.name || '').trim(),
          category: String(event?.category || parent.category || '').toUpperCase(),
          rows: (event?.races || []).flatMap(race => (race?.results || [])
            .filter(r => (Array.isArray(r?.athletes) ? r.athletes : []).some(a => String(a?.id) === String(id)))
            .map(r => ({ mark:r.mark ?? null, place:Number(r.place) || null, wind:r.wind ?? null, records:normalizeRecords(r.records ?? r.record), date:r.date ?? race?.date ?? parent.date ?? null }))
          )
        }));
      }
    } catch (e) {
      attemptInfo.error = String(e?.message || e);
    }

    if (!events) {
      try {
        const flat = await fetchDirectCompetitionResults(context.env, competitionId, id);
        events = Object.values(flat.reduce((byDiscipline, r) => {
          (byDiscipline[r.discipline] ||= { discipline:r.discipline, category:parent.category||'', rows:[] })
            .rows.push({ mark:r.mark, place:Number(r.place) || null, wind:r.wind, records:normalizeRecords(r.records), date:r.date ?? parent.date ?? null });
          return byDiscipline;
        }, {}));
        attemptInfo.fallback = 'worldathletics.org (direkte)';
        attemptInfo.fallbackCount = flat.length;
      } catch (e) {
        attemptInfo.fallbackError = String(e?.message || e);
      }
    }

    enrichedAttempts.push(attemptInfo);
    if (!Array.isArray(events)) return;

    for (const event of events) {
      if (!event.discipline || /decathlon|heptathlon|pentathlon/i.test(event.discipline)) continue;
      for (const row of event.rows) {
        if (row.mark == null) continue;
        results.push({
          year: parent.year,
          discipline: event.discipline,
          mark: row.mark,
          resultScore: 0,
          place: row.place,
          category: event.category,
          competition: parent.competition ?? null,
          competitionId,
          date: row.date,
          legal: true,
          wind: row.wind,
          records: row.records,
          source: 'combined-event-subevent'
        });
      }
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
