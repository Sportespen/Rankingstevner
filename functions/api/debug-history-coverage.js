// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site, e.g.
// /api/debug-history-coverage?event=100m&sex=M&limit=6
//
// v2: only tests meets whose CONFIRMED program actually includes the selected event (same
// matching meet-finder-v1.js's programConfirmsEvent uses to decide whether a meet shows in
// Stevnefinner at all) - the first version tested a raw, unfiltered sample, which included
// meets that would never appear in the real list anyway (e.g. a throws-only meet under a 100m
// search) and made "Historisk nivå" look worse than it is for meets a real user actually sees.
// Runs the real /api/meet-history lookup against that filtered sample, categorizing each result
// so the actual failure distribution - across meets that genuinely matter - is visible at once.
const DIRECT_PROGRAM_EVENT_CODE={
  '100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m',
  '100mh':'100mH','110mh':'110mH','400mh':'400mH','3000msc':'3000mSC','3000m steeplechase':'3000mSC',
  'high jump':'HJ','pole vault':'PV','long jump':'LJ','triple jump':'TJ',
  'shot put':'SP','discus throw':'DT','discus':'DT','hammer throw':'HT','hammer':'HT','javelin throw':'JT','javelin':'JT',
  'decathlon':'Decathlon','heptathlon':'Heptathlon',
};
function programEventBaseName(s){
  return String(s||'').replace(/\([^)]*\)/g,' ').replace(/\bU ?23\b/gi,' ').replace(/\bsh\b/gi,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
function programConfirmsEvent(eventsProgram,code,sex,indoor){
  if(!Array.isArray(eventsProgram)||!eventsProgram.length)return null;
  const wantGender=sex==='W'?'women':'men';
  for(const unit of eventsProgram){
    if(String(unit?.gender||'').toLowerCase()!==wantGender)continue;
    for(const raw of (Array.isArray(unit.events)?unit.events:[])){
      const base=programEventBaseName(raw);
      if(DIRECT_PROGRAM_EVENT_CODE[base]===code)return true;
      if(indoor&&base==='60m'&&code==='100m')return true;
      if(indoor&&base==='60mh'&&(code==='100mH'||code==='110mH'))return true;
    }
  }
  return false;
}
const FETCH_TIMEOUT_MS=20000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const event=(url.searchParams.get('event')||'100m').trim();
  const sex=(url.searchParams.get('sex')||'M').trim().toUpperCase()==='W'?'W':'M';
  const limit=Math.min(Number(url.searchParams.get('limit'))||6,10);
  const pool=Math.min(Number(url.searchParams.get('pool'))||15,25);
  const origin=url.origin;
  const today=new Date().toISOString().slice(0,10);

  let candidates=[];
  try{
    const searchRes=await fetchWithTimeout(`${origin}/api/meet-search?event=${encodeURIComponent(event)}&startDate=${today}&endDate=2027-12-31&v=1&t=${Date.now()}`);
    const searchData=await searchRes.json();
    candidates=(Array.isArray(searchData?.results)?searchData.results:[]).filter(m=>m?.id).slice(0,pool);
  }catch(e){
    return json({ok:false,error:'meet-search failed: '+String(e?.message||e)},502);
  }

  // Stage 1: fetch each candidate's confirmed program and check whether it actually includes
  // the target event - same check that decides whether the meet shows in Stevnefinner at all.
  const withProgram=await Promise.all(candidates.map(async m=>{
    try{
      const detRes=await fetchWithTimeout(`${origin}/api/meet-details?id=${encodeURIComponent(m.id)}&t=${Date.now()}`);
      const det=await detRes.json();
      const program=Array.isArray(det?.details?.eventsProgram)?det.details.eventsProgram:[];
      const indoor=String(m.venueType||'').toLowerCase()==='indoor';
      const confirmed=programConfirmsEvent(program,event,sex,indoor);
      return {meet:m,confirmed,programKnown:program.length>0};
    }catch(e){
      return {meet:m,confirmed:null,programKnown:false,error:String(e?.message||e)};
    }
  }));

  const visibleMeets=withProgram.filter(x=>x.confirmed===true).map(x=>x.meet).slice(0,limit);
  const excludedCount=withProgram.filter(x=>x.confirmed===false).length;
  const unknownProgramCount=withProgram.filter(x=>x.confirmed===null).length;

  // Stage 2: run the real historical-results lookup only against meets that would actually be
  // visible to a user searching this event.
  const results=await Promise.all(visibleMeets.map(async m=>{
    try{
      const histRes=await fetchWithTimeout(`${origin}/api/meet-history?name=${encodeURIComponent(m.name)}&event=${encodeURIComponent(event)}&sex=${sex}&date=${encodeURIComponent(m.start||'')}&t=${Date.now()}`);
      const hist=await histRes.json();
      let category;
      if(hist?.found)category='found';
      else if(hist?.reason==='no-previous-edition-found')category='no-candidate';
      else if(hist?.reason==='no-standings-found')category='candidate-no-standings';
      else if(hist?.reason==='known-competition-no-standings')category='known-competition-no-standings';
      else if(hist?.reason==='unsupported-event')category='unsupported-event';
      else category='other:'+String(hist?.reason||hist?.error||'unknown');
      const matchDiag=(hist?.diagnostics||[]).find(d=>d.source==='match');
      return {
        name:m.name,start:m.start,id:m.id,category,
        matchedMeetName:hist?.matchedMeetName||null,
        year:hist?.year||null,
        bestCandidate:matchDiag?.topMatches?.[0]||null,
      };
    }catch(e){
      return {name:m.name,start:m.start,id:m.id,category:'fetch-error',error:String(e?.message||e)};
    }
  }));

  const summary={};
  for(const r of results)summary[r.category]=(summary[r.category]||0)+1;

  return json({
    ok:true,event,sex,
    poolSize:candidates.length,
    excludedByProgram:excludedCount,
    programUnknown:unknownProgramCount,
    visibleTested:results.length,
    summary,results,
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
