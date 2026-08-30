// TEMPORARY diagnostic, not wired into any UI - visit this URL directly on the deployed site,
// e.g. /api/debug-wa-rankings-shape?event=100m&sex=M
// worldathletics.org/world-rankings/{event}/{sex} returned real HTML (confirmed live: status 200,
// ~515KB) but with no __NEXT_DATA__ script tag - unlike the calendar-results/results pages this
// app already scrapes successfully. That means either this page uses a different embedded-data
// convention (some other script id) or the actual ranking table loads via a separate client-side
// API call this page's own JavaScript makes after the initial HTML - which wouldn't appear in the
// raw HTML at all. This pulls out every clue that could answer which: all <script src> bundle
// URLs (to find and read the app's own JS for a fetch()/API call pattern), every inline
// <script id="..."> block regardless of id, and any substring in the raw HTML that looks like an
// API path (containing "/api/", ".json", or "graphql").
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
  const sexPath=sex==='W'?'women':'men';
  const pageUrl=`https://worldathletics.org/world-rankings/${event}/${sexPath}`;

  let html='';
  try{
    const r=await fetchWithTimeout(pageUrl,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
    if(!r.ok)return json({ok:false,pageUrl,status:r.status});
    html=await r.text();
  }catch(e){
    return json({ok:false,pageUrl,error:String(e?.message||e)});
  }

  const scriptSrcs=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
  const inlineScriptIds=[...html.matchAll(/<script[^>]+id=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
  const inlineScriptsNoId=(html.match(/<script(?![^>]*\bsrc=)(?![^>]*\bid=)[^>]*>[\s\S]{0,50}/gi)||[]).length;
  const apiLikeStrings=[...new Set([...html.matchAll(/["']([^"']*(?:\/api\/|\.json|graphql)[^"']*)["']/gi)].map(m=>m[1]))].slice(0,40);
  const bodyStart=html.indexOf('<body');
  const bodySample=bodyStart>=0?html.slice(bodyStart,bodyStart+2000):null;

  return json({
    ok:true,
    pageUrl,
    htmlLength:html.length,
    scriptSrcs,
    inlineScriptIds,
    inlineScriptsWithoutIdOrSrc:inlineScriptsNoId,
    apiLikeStrings,
    bodySample
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
