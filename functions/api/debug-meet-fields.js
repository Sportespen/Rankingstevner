// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site,
// e.g. /api/debug-meet-fields?name=U23%20Championships&event=100m
// The national-championship filter (meet-finder-v1.js's isNationalChampionship()) only matches
// competitionGroup === "National Championships" - but real meets like "Swiss U23 Championships"
// and "Croatian U23 Championships" are still showing up for a Norwegian athlete, meaning WA
// likely tags these with a DIFFERENT competitionGroup value (maybe something U23-specific) that
// this classifier doesn't recognize yet. This re-fetches the same calendar data meet-search.js
// does and dumps the full raw object for any meet whose name contains the given filter, so the
// real field value can be read directly instead of guessed at again.
const FETCH_TIMEOUT_MS=8000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const nameFilter=(url.searchParams.get('name')||'').toLowerCase().trim();
  const event=(url.searchParams.get('event')||'').trim();
  const combined=event==='Decathlon'||event==='Heptathlon';
  const startDate=(url.searchParams.get('startDate')||new Date().toISOString().slice(0,10));
  const endDate=(url.searchParams.get('endDate')||'2027-12-31');

  const disciplineId=combined?'1':'';
  const pagePromises=[0,100,200,300,400,500,600,700,800,900].map(async offset=>{
    const wa=new URL('https://worldathletics.org/competition/calendar-results');
    wa.searchParams.set('isSearchReset','true');
    wa.searchParams.set('startDate',startDate);
    wa.searchParams.set('endDate',endDate);
    wa.searchParams.set('regionId','3');
    wa.searchParams.set('regionType','area');
    if(disciplineId)wa.searchParams.set('disciplineId',disciplineId);
    if(offset)wa.searchParams.set('offset',String(offset));
    try{
      const r=await fetchWithTimeout(wa.toString(),{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
      if(!r.ok)return [];
      const html=await r.text();
      return extractCalendarObjects(html);
    }catch(_){return [];}
  });

  const pages=await Promise.all(pagePromises);
  const all=pages.flat();
  const matched=nameFilter?all.filter(m=>String(m?.name||'').toLowerCase().includes(nameFilter)):all.slice(0,20);

  return json({
    ok:true,
    totalFetched:all.length,
    nameFilter,
    matchedCount:matched.length,
    matched
  });
}

function decode(v){return String(v||'').replace(/\\u0026/g,'&').replace(/\\u003c/g,'<').replace(/\\u003e/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');}
function walk(v,out){if(!v)return;if(Array.isArray(v)){for(const x of v)walk(x,out);return;}if(typeof v!=='object')return;const name=v.name||v.competitionName;const start=v.startDate||v.start;const end=v.endDate||v.end;const disciplines=v.disciplines;if(name&&start&&(disciplines||v.rankingCategory||v.venue)){out.push(v);}for(const x of Object.values(v))walk(x,out);}
function extractCalendarObjects(html){const out=[];const m=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);if(m){try{const data=JSON.parse(decode(m[1]));walk(data,out);}catch(_){}}return out;}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
