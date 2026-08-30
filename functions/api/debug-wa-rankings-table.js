// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site,
// e.g. /api/debug-wa-rankings-table?event=100m&sex=M
// Neither the shared JS bundle nor an obvious AJAX call turned up anything - this
// checks a third possibility: that the ranking table is rendered directly into the
// page's own HTML server-side (typical of this older "iaaforg" template), with no
// separate data call at all. Reports match counts + a context sample for several
// markers a rendered ranking table would plausibly use, so the real structure can
// be identified without guessing the exact class names blind.
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

  const markers=['rankingRow','ranking-row','rankingList','ranking-list','ranking-table','rankingTable','competitorName','competitor-name','table-row','list-group-item','records-table','recordsTable','data-rank','flag-icon','toplist','topList','worldRanking','world-ranking'];
  const report=markers.map(kw=>{
    const re=new RegExp(kw,'gi');
    const matches=[...html.matchAll(re)];
    const count=matches.length;
    let sample=null;
    if(count>0){
      const idx=matches[Math.floor(matches.length/2)].index;
      sample=html.slice(Math.max(0,idx-150),idx+250);
    }
    return {kw,count,sample};
  }).filter(r=>r.count>0);

  const numberDensePatches=[];
  const chunkSize=20000;
  for(let i=0;i<html.length;i+=chunkSize){
    const chunk=html.slice(i,i+chunkSize);
    const nums=(chunk.match(/>\s*\d{3,4}\s*</g)||[]).length;
    if(nums>=8)numberDensePatches.push({offset:i,scoreLikeNumberCount:nums,sample:chunk.slice(0,600)});
  }

  return json({
    ok:true,
    pageUrl,
    htmlLength:html.length,
    markerReport:report,
    numberDensePatchCount:numberDensePatches.length,
    numberDensePatches:numberDensePatches.slice(0,3)
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
