// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site,
// e.g. /api/debug-wa-rankings-require?event=100m&sex=M
// The shared bundle (common.min.js) has zero "ranking" references, so the table's
// data-loading code must live in a page-specific module loaded via RequireJS
// (the page also loads /Assets/Scripts/requirejs/2.1.15/require.min.js). RequireJS
// modules are named in require([...]) / requirejs.config({...}) calls written
// directly in the page HTML, not as <script src> tags - so this pulls every inline
// <script> block's full text (not just a preview) whenever it contains "require(",
// "requirejs", "define(", or an "app/" path, plus any bare "/Scripts/app/..." or
// ".ashx"/"/api/" path anywhere in the whole HTML.
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

  const scriptBlocks=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .map(m=>({attrs:m[1],body:m[2]}))
    .filter(s=>!/\bsrc=/.test(s.attrs))
    .filter(s=>/require\(|requirejs|define\(|app\//i.test(s.body))
    .map(s=>({attrs:s.attrs.trim(),body:s.body.trim().slice(0,4000)}));

  const pathLike=[...new Set([...html.matchAll(/["']([^"']*(?:\/Scripts\/app\/[^"']*|\.ashx[^"']*|\/api\/[^"']*))["']/gi)].map(m=>m[1]))].slice(0,60);

  return json({
    ok:true,
    pageUrl,
    htmlLength:html.length,
    requireLikeScriptCount:scriptBlocks.length,
    requireLikeScripts:scriptBlocks,
    pathLikeStrings:pathLike
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
