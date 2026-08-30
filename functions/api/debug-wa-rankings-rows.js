// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site,
// e.g. /api/debug-wa-rankings-rows?event=100m&sex=M&page=1
// Confirmed: worldathletics.org/world-rankings/{event}/{sex} renders its ranking
// table server-side directly into the HTML (no AJAX call, no auth) - real, global
// rows with data-th="Rank"/"Competitor"/"DOB"/"Nat". This extracts full <tr> blocks
// (all their <td data-th="..."> pairs) for the first and last few rows of the
// requested page, plus the highest page number found in the pagination links, so
// the exact column set (esp. the score field name) and page size can be confirmed,
// and whether rows are in strict descending score order across pages.
const FETCH_TIMEOUT_MS=8000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{ return await fetch(url,{...options,signal:controller.signal}); }
  finally{ clearTimeout(timer); }
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const event=(url.searchParams.get('event')||'100m').trim();
  const sex=(url.searchParams.get('sex')||'M').trim().toUpperCase();
  const page=(url.searchParams.get('page')||'1').trim();
  const sexPath=sex==='W'?'women':'men';
  const pageUrl=`https://worldathletics.org/world-rankings/${event}/${sexPath}?page=${encodeURIComponent(page)}`;

  let html='';
  try{
    const r=await fetchWithTimeout(pageUrl,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
    if(!r.ok)return json({ok:false,pageUrl,status:r.status});
    html=await r.text();
  }catch(e){
    return json({ok:false,pageUrl,error:String(e?.message||e)});
  }

  const rowRe=/<tr[^>]*data-id="(\d+)"[^>]*data-athlete-url="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows=[];
  let m;
  while((m=rowRe.exec(html))){
    const cellRe=/<td[^>]*data-th="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi;
    const cells={};
    let c;
    while((c=cellRe.exec(m[3]))){
      cells[c[1]]=c[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    }
    rows.push({id:m[1],athleteUrl:m[2],cells});
  }

  const maxPage=Math.max(0,...[...html.matchAll(/data-page="(\d+)"/gi)].map(x=>Number(x[1])));

  return json({
    ok:true,
    pageUrl,
    htmlLength:html.length,
    totalRowsFound:rows.length,
    maxPageSeen:maxPage,
    firstRows:rows.slice(0,3),
    lastRows:rows.slice(-3)
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
