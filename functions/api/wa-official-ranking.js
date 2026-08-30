const WA_RANKING_API='https://api.european-athletics.com/trpc';

// Nothing in this file previously bounded how long a single external call could take - a slow or
// hanging request had no fallback, leaving the frontend's "…" loading state up indefinitely
// instead of ever resolving to a real number or an honest "–". This wraps every external fetch
// with a hard deadline so a stuck call fails fast (with a real error in diagnostics) instead of
// stalling the whole lookup chain.
const FETCH_TIMEOUT_MS=6000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    return await fetch(url,{...options,signal:controller.signal});
  }finally{
    clearTimeout(timer);
  }
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  const sex=(url.searchParams.get('sex')||'').trim().toUpperCase();
  const newScoreRaw=(url.searchParams.get('newScore')||'').trim();
  const newScore=newScoreRaw?Number(newScoreRaw):null;
  if(!id)return json({ok:false,error:'Ugyldig World Athletics-ID'},400);
  if(!event)return json({ok:false,error:'Mangler øvelse'},400);

  const diagnostics=[];
  let profile=null,name='',knownRank=null,athleteSlug='';
  try{
    const r=await fetchWithTimeout(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.23.0','Accept':'application/json'}});
    if(r.ok){
      profile=await r.json();
      name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
      athleteSlug=String(profile?.urlSlug||profile?.slug||'').trim();
      const current=Array.isArray(profile?.currentWorldRankings)?profile.currentWorldRankings:[];
      const hit=current.find(x=>rankingEventMatches(x?.eventGroup,event));
      const p=Number(hit?.place); if(validRank(p))knownRank=p;
      diagnostics.push({source:'wa-profile',status:r.status,name,athleteSlug,knownRank,eventGroup:hit?.eventGroup||null});
    }else diagnostics.push({source:'wa-profile',status:r.status});
  }catch(e){diagnostics.push({source:'wa-profile',error:String(e?.message||e)});}

  const slug=rankingSlug(event);
  const gender=sex==='W'?'women':'men';

  // Finds this athlete's row in the ranking-calculation lookup this app has access to, purely to
  // read off their real WA Ranking Score and basis breakdown (score and basis are the athlete's
  // own calculated values regardless of which lookup found the row - not scope-dependent). The
  // real WORLD rank shown below always comes from `knownRank` (fetched directly above, from
  // World Athletics' own backend) - never from this lookup's own row data.
  let official=null;
  if(slug&&name){
    official=await fetchRankingRow(slug,gender,name,athleteSlug,knownRank,diagnostics);
  }

  // Estimates where a hypothetical new score would place in World Athletics' own
  // public world-rankings list (worldathletics.org/world-rankings/{slug}/{gender}),
  // scraped directly - real, global rows, nothing from EA. Independent of the
  // score/basis lookup above, so it runs regardless of whether that lookup found
  // the athlete's own row.
  let estimatedNewRank=null;
  if(slug&&validScore(newScore)){
    estimatedNewRank=await estimateNewWorldRank(slug,gender,newScore,knownRank,diagnostics);
  }

  if(official){
    const calc=await fetchRankingCalculation(official.row.id,diagnostics);
    const basis=Array.isArray(calc?.results)?calc.results.map(normalizeBasis).filter(Boolean):[];
    return json({
      ok:true,id:Number(id),event,name,
      rank:knownRank,
      rankScope:knownRank?'world':null,
      score:Number(official.row.rankingScore),
      source:'World Athletics official ranking data',
      sourceUrl:`https://worldathletics.org/world-rankings/${slug}/${sex==='W'?'m':'men'}`,
      verifiedPublished:true,
      basisVerified:basis.length>0,
      averagePerformanceScore:Number(calc?.averagePerformanceScore)||null,
      calculationId:Number(official.row.id)||null,
      basis,
      estimatedNewRank,
      diagnostics
    });
  }

  return json({ok:true,id:Number(id),event,name,rank:knownRank,rankScope:knownRank?'world':null,score:null,verifiedPublished:false,basisVerified:false,basis:[],estimatedNewRank,diagnostics});
}

async function rankingApi(proc,input){
  const q=encodeURIComponent(JSON.stringify({json:input}));
  const r=await fetchWithTimeout(`${WA_RANKING_API}/${proc}?input=${q}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.22.1','Accept':'application/json'}});
  const text=await r.text(); let body=null; try{body=JSON.parse(text);}catch(_){}
  if(!r.ok||body?.error)throw new Error(`${proc}: ${r.status} ${body?.error?.json?.message||text.slice(0,120)}`);
  return body?.result?.data?.json;
}

function athleteMatches(row,wantedName,wantedSlug){
  const rowSlug=String(row?.athleteUrlSlug||'').trim();
  if(wantedSlug&&rowSlug&&rowSlug===wantedSlug)return true;
  const rn=normalizeName(row?.athlete),wn=normalizeName(wantedName);
  return rn===wn || (rn&&wn&&(rn.includes(wn)||wn.includes(rn)));
}

async function fetchRankingRow(slug,gender,name,athleteSlug,knownRank,diagnostics){
  let first=null;
  try{
    first=await rankingApi('worldAthletics.getRanking',{eventGroup:slug,gender,page:1});
  }catch(e){diagnostics.push({source:'wa-ranking',slug,gender,page:1,error:String(e?.message||e)});return null;}

  const firstRows=Array.isArray(first?.rankings)?first.rankings:[];
  const maxPages=Math.max(1,Number(first?.pages)||1);
  const pageSize=Math.max(1,firstRows.length||100);
  let row=firstRows.find(r=>athleteMatches(r,name,athleteSlug));
  diagnostics.push({source:'wa-ranking',slug,gender,page:1,count:firstRows.length,pages:maxPages,pageSize,knownRank,found:!!row});
  if(row&&validScore(row.rankingScore))return {row,page:1};

  const targets=[];
  if(validRank(knownRank)){
    const byWorldRank=Math.max(1,Math.ceil(Number(knownRank)/pageSize));
    for(const p of [byWorldRank,byWorldRank-1,byWorldRank+1,byWorldRank-2,byWorldRank+2]){
      if(p>=2&&p<=maxPages&&!targets.includes(p))targets.push(p);
    }
  }

  for(const page of targets){
    try{
      const data=await rankingApi('worldAthletics.getRanking',{eventGroup:slug,gender,page});
      const rows=Array.isArray(data?.rankings)?data.rankings:[];
      row=rows.find(r=>athleteMatches(r,name,athleteSlug));
      diagnostics.push({source:'wa-ranking-targeted',slug,gender,page,count:rows.length,found:!!row});
      if(row&&validScore(row.rankingScore))return {row,page};
    }catch(e){diagnostics.push({source:'wa-ranking-targeted',slug,gender,page,error:String(e?.message||e)});}
  }

  // Fallback: scan the remaining pages. This is only used when the athlete's
  // world rank and the gateway's page order differ (common in deep sprint lists).
  for(let page=2;page<=maxPages;page++){
    if(targets.includes(page))continue;
    try{
      const data=await rankingApi('worldAthletics.getRanking',{eventGroup:slug,gender,page});
      const rows=Array.isArray(data?.rankings)?data.rankings:[];
      row=rows.find(r=>athleteMatches(r,name,athleteSlug));
      if(row&&validScore(row.rankingScore)){
        diagnostics.push({source:'wa-ranking-fullscan',slug,gender,page,found:true});
        return {row,page};
      }
    }catch(e){diagnostics.push({source:'wa-ranking-fullscan',slug,gender,page,error:String(e?.message||e)});break;}
  }
  return null;
}

// Real, global World Athletics world-rankings pages render their table directly
// into the page HTML (confirmed live: data-th="Rank"/"Competitor"/"score" per row,
// 100 rows/page, strictly descending by score) - no AJAX call, no API key, nothing
// from EA. This walks that list with a binary search over pages to find exactly
// where a hypothetical score would land.
async function fetchWorldRankingPage(slug,genderPath,page,diagnostics){
  const pageUrl=`https://worldathletics.org/world-rankings/${slug}/${genderPath}?page=${page}`;
  let html;
  try{
    const r=await fetchWithTimeout(pageUrl,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
    if(!r.ok){diagnostics.push({source:'wa-world-rankings',slug,genderPath,page,status:r.status});return null;}
    html=await r.text();
  }catch(e){diagnostics.push({source:'wa-world-rankings',slug,genderPath,page,error:String(e?.message||e)});return null;}

  const rows=[];
  const rowRe=/<tr[^>]*data-id="(\d+)"[^>]*data-athlete-url="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while((m=rowRe.exec(html))){
    const cellRe=/<td[^>]*data-th="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi;
    const cells={};
    let c;
    while((c=cellRe.exec(m[3])))cells[c[1]]=c[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    const rank=Number(cells.Rank),score=Number(cells.score??cells.Score);
    if(Number.isFinite(rank)&&Number.isFinite(score))rows.push({rank,score});
  }
  const maxPage=Math.max(1,...[...html.matchAll(/data-page="(\d+)"/gi)].map(x=>Number(x[1])),1);
  diagnostics.push({source:'wa-world-rankings',slug,genderPath,page,rows:rows.length,maxPage});
  return {rows,maxPage};
}

async function estimateNewWorldRank(slug,genderPath,targetScore,knownRank,diagnostics){
  const pageSize=100;
  const first=await fetchWorldRankingPage(slug,genderPath,1,diagnostics);
  if(!first||!first.rows.length)return null;
  const maxPage=first.maxPage;
  if(targetScore>=first.rows[0].score)return 1;

  let lo=1,hi=maxPage,foundPage=null;
  const pageData={1:first};
  const budget=10;
  let fetches=1;
  while(lo<=hi&&fetches<budget){
    const mid=Math.ceil((lo+hi)/2);
    let data=pageData[mid];
    if(!data){data=await fetchWorldRankingPage(slug,genderPath,mid,diagnostics);fetches++;pageData[mid]=data;}
    if(!data||!data.rows.length){hi=mid-1;continue;}
    const top=data.rows[0].score,bottom=data.rows[data.rows.length-1].score;
    if(targetScore>top)hi=mid-1;
    else if(targetScore<bottom)lo=mid+1;
    else{foundPage=mid;break;}
  }
  if(foundPage==null){
    foundPage=Math.min(maxPage,Math.max(1,lo));
    if(!pageData[foundPage]){pageData[foundPage]=await fetchWorldRankingPage(slug,genderPath,foundPage,diagnostics);fetches++;}
  }
  const data=pageData[foundPage];
  if(!data||!data.rows.length)return null;
  if(foundPage===maxPage&&targetScore<data.rows[data.rows.length-1].score)return null;
  let idx=data.rows.findIndex(r=>r.score<=targetScore);
  if(idx===-1)idx=data.rows.length;
  return (foundPage-1)*pageSize+idx+1;
}

async function fetchRankingCalculation(calculationId,diagnostics){
  if(!Number.isFinite(Number(calculationId)))return null;
  try{
    const data=await rankingApi('worldAthletics.getRankingScoreCalculation',{calculationId:Number(calculationId)});
    diagnostics.push({source:'wa-ranking-calculation',calculationId:Number(calculationId),count:Array.isArray(data?.results)?data.results.length:0,averagePerformanceScore:data?.averagePerformanceScore||null});
    return data||null;
  }catch(e){diagnostics.push({source:'wa-ranking-calculation',calculationId:Number(calculationId),error:String(e?.message||e)});return null;}
}

function normalizeBasis(r){
  if(!r)return null;
  return {
    date:r.date||null,
    competition:r.competition||null,
    country:r.country||null,
    category:r.category||null,
    discipline:r.discipline||null,
    race:r.race||null,
    place:r.place||null,
    result:r.mark||null,
    mark:r.mark||null,
    wind:r.wind||null,
    resultScore:num(r.resultScore),
    placingScore:num(r.placingScore),
    performanceScore:num(r.performanceScore)
  };
}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function rankingSlug(c){return ({'100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m','100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',HJ:'high-jump',PV:'pole-vault',LJ:'long-jump',TJ:'triple-jump',SP:'shot-put',DT:'discus-throw',HT:'hammer-throw',JT:'javelin-throw',Decathlon:'decathlon',Heptathlon:'heptathlon'})[c]||'';}
function rankingEventMatches(g,c){const n=norm(g),a={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon','combinedevents','combinedevent'],Heptathlon:['heptathlon','combinedevents','combinedevent']};return (a[c]||[]).some(x=>n===x||n.startsWith(x)||n.includes(x));}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a').replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=500&&n<=1800;}
function validRank(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<10000;}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
