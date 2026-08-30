// TEMPORARY diagnostic, not wired into any UI - visit directly on the deployed site,
// e.g. /api/debug-raw-basis?id=14989292&event=100m&sex=W
// The Type (Main/Similar Event) badge misclassifies some rows (e.g. a genuine 60m indoor result
// showing "-" instead of "Similar Event" for a 100m ranking) despite the alias fix, which means
// the discipline field's actual raw format from WA's calculation-breakdown endpoint
// (worldAthletics.getRankingScoreCalculation) may not match what was assumed. This dumps the
// UNMODIFIED calc.results rows (before normalizeBasis()) so the real field names/values can be
// inspected directly instead of guessed at again.
const WA_RANKING_API='https://api.european-athletics.com/trpc';
const FETCH_TIMEOUT_MS=6000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
}
async function rankingApi(proc,input){
  const q=encodeURIComponent(JSON.stringify({json:input}));
  const r=await fetchWithTimeout(`${WA_RANKING_API}/${proc}?input=${q}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/1.0','Accept':'application/json'}});
  const text=await r.text();let body=null;try{body=JSON.parse(text);}catch(_){}
  if(!r.ok||body?.error)throw new Error(`${proc}: ${r.status} ${body?.error?.json?.message||text.slice(0,120)}`);
  return body?.result?.data?.json;
}
function rankingSlug(c){return ({'100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m','100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',HJ:'high-jump',PV:'pole-vault',LJ:'long-jump',TJ:'triple-jump',SP:'shot-put',DT:'discus-throw',HT:'hammer-throw',JT:'javelin-throw',Decathlon:'decathlon',Heptathlon:'heptathlon'})[c]||'';}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  const sex=(url.searchParams.get('sex')||'').trim().toUpperCase();
  if(!id||!event)return json({ok:false,error:'Krever id og event'},400);

  let name='',knownRank=null,athleteSlug='';
  try{
    const r=await fetchWithTimeout(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/1.0','Accept':'application/json'}});
    if(r.ok){
      const profile=await r.json();
      name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
      athleteSlug=String(profile?.urlSlug||profile?.slug||'').trim();
    }
  }catch(_){}

  const slug=rankingSlug(event);
  const gender=sex==='W'?'women':'men';
  const pageSize=100;

  // Find the athlete's WA world-rankings row (same mechanism as the real backend) purely to get
  // its id for the calculation lookup - a plain page-1-through-a-few-pages search since we don't
  // have a known rank handy here.
  let waId=null,waPage=null;
  for(let page=1;page<=5;page++){
    const pageUrl=`https://worldathletics.org/world-rankings/${slug}/${gender}?page=${page}`;
    try{
      const r=await fetchWithTimeout(pageUrl,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
      if(!r.ok)continue;
      const html=await r.text();
      const rowRe=/<tr[^>]*data-id="(\d+)"[^>]*data-athlete-url="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
      let m;
      while((m=rowRe.exec(html))){
        if(m[2].includes(String(athleteSlug))||m[3].toLowerCase().includes(name.toLowerCase().split(' ').pop()||'~~')){
          waId=Number(m[1]);waPage=page;break;
        }
      }
      if(waId)break;
    }catch(_){}
  }

  let calc=null,calcError=null;
  if(waId){
    try{calc=await rankingApi('worldAthletics.getRankingScoreCalculation',{calculationId:waId});}
    catch(e){calcError=String(e?.message||e);}
  }

  return json({
    ok:true,
    id:Number(id),name,athleteSlug,event,slug,gender,
    waId,waPage,
    calcError,
    rawResultsCount:Array.isArray(calc?.results)?calc.results.length:null,
    rawResults:Array.isArray(calc?.results)?calc.results:calc
  });
}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
