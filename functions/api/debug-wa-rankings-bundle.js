// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site,
// e.g. /api/debug-wa-rankings-bundle
// The world-rankings page (see debug-wa-rankings-shape) is World Athletics' legacy
// Knockout.js template ("iaaforg"), not the Next.js pages this app already scrapes.
// Its ranking table is very likely populated by an AJAX call made from this bundle
// after page load. This fetches the bundle and pulls out every substring near the
// word "ranking" (case-insensitive) plus any URL-looking token containing ".ashx",
// "/api/", "/Ranking" or "GetRanking", so we can find the real endpoint the page
// itself calls to fill the table.
const FETCH_TIMEOUT_MS=8000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{ return await fetch(url,{...options,signal:controller.signal}); }
  finally{ clearTimeout(timer); }
}

export async function onRequestGet(context){
  const bundleUrl='https://worldathletics.org/Assets/Scripts/app/bundles/common.min.js?v=2146134028';
  let js='';
  try{
    const r=await fetchWithTimeout(bundleUrl,{headers:{Accept:'*/*','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
    if(!r.ok)return json({ok:false,bundleUrl,status:r.status});
    js=await r.text();
  }catch(e){
    return json({ok:false,bundleUrl,error:String(e?.message||e)});
  }

  const rankingHits=[];
  const re=/ranking/gi;
  let m,count=0;
  while((m=re.exec(js))&&count<60){
    const start=Math.max(0,m.index-60),end=Math.min(js.length,m.index+80);
    rankingHits.push(js.slice(start,end));
    count++;
  }
  const urlLike=[...new Set([...js.matchAll(/["']([^"']*(?:\.ashx|\/api\/|\/Ranking|GetRanking)[^"']*)["']/gi)].map(x=>x[1]))].slice(0,60);

  return json({
    ok:true,
    bundleUrl,
    jsLength:js.length,
    rankingHitCount:count,
    rankingHits,
    urlLikeStrings:urlLike
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
