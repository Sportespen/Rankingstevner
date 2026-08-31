// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site, e.g.
// /api/debug-history-coverage?event=100m&sex=M&limit=10
//
// Runs the real /api/meet-history lookup against a sample of real upcoming meets (pulled from
// /api/meet-search, same as Stevnefinner itself shows) to see WHERE in the pipeline "not found"
// results concentrate, across many meets at once instead of debugging one report at a time:
//   - "no-candidate": the window/name-matching search never found a plausible previous edition
//     at all - a name-matching or date-window gap, or the meet genuinely has no prior edition.
//   - "candidate-no-standings": a previous edition WAS found and matched, but the results page
//     couldn't be parsed for this event - a day/eventId guessing or extraction gap.
//   - "found": worked end to end.
// This tells us which stage actually deserves more work instead of guessing.
export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const event=(url.searchParams.get('event')||'100m').trim();
  const sex=(url.searchParams.get('sex')||'M').trim().toUpperCase()==='W'?'W':'M';
  const limit=Math.min(Number(url.searchParams.get('limit'))||10,15);
  const origin=url.origin;
  const today=new Date().toISOString().slice(0,10);

  let meets=[];
  try{
    const searchRes=await fetch(`${origin}/api/meet-search?event=${encodeURIComponent(event)}&startDate=${today}&endDate=2027-12-31&v=1&t=${Date.now()}`);
    const searchData=await searchRes.json();
    meets=(Array.isArray(searchData?.results)?searchData.results:[]).slice(0,limit);
  }catch(e){
    return json({ok:false,error:'meet-search failed: '+String(e?.message||e)},502);
  }

  const results=await Promise.all(meets.map(async m=>{
    try{
      const histRes=await fetch(`${origin}/api/meet-history?name=${encodeURIComponent(m.name)}&event=${encodeURIComponent(event)}&sex=${sex}&date=${encodeURIComponent(m.start||'')}&t=${Date.now()}`);
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
        name:m.name,start:m.start,category,
        matchedMeetName:hist?.matchedMeetName||null,
        year:hist?.year||null,
        bestCandidate:matchDiag?.topMatches?.[0]||null,
        candidateCount:matchDiag?.candidateCount??null,
      };
    }catch(e){
      return {name:m.name,start:m.start,category:'fetch-error',error:String(e?.message||e)};
    }
  }));

  const summary={};
  for(const r of results)summary[r.category]=(summary[r.category]||0)+1;

  return json({ok:true,event,sex,totalTested:results.length,summary,results});
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
