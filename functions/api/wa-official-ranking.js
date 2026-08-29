// Fetches an athlete's real World Athletics world rank AND Ranking Score directly from WA's own
// world-rankings page (worldathletics.org/world-rankings/{event}/{sex}) - not any third-party
// mirror. Previously used api.european-athletics.com's tRPC gateway, but live diagnostics
// conclusively proved that list is Europe-scoped (every sampled row's own `nationality` field was
// a European country) - not the world ranking this app needs, and per explicit instruction EA is
// removed entirely rather than kept as a fallback. This scrapes WA's own real page instead, using
// the same __NEXT_DATA__ parsing technique already proven working for "Historisk nivå" (see
// functions/api/meet-history.js). The exact JSON shape of THIS specific page has never been
// confirmed live (this dev sandbox has no network access to verify it, same constraint as
// everything else scraped from worldathletics.org this session) - ships with rich diagnostics so
// a live report can fix any wrong shape assumption in one more round, the same loop that got
// Historisk nivå working.
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
  const newScoreRaw=url.searchParams.get('newScore');
  const newScore=newScoreRaw!=null&&newScoreRaw!==''?Number(newScoreRaw):null;
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
      diagnostics.push({source:'nimarion-profile',status:r.status,name,athleteSlug,knownRank,eventGroup:hit?.eventGroup||null});
    }else diagnostics.push({source:'nimarion-profile',status:r.status});
  }catch(e){diagnostics.push({source:'nimarion-profile',error:String(e?.message||e)});}

  const slug=rankingSlug(event);
  const sexPath=sex==='W'?'women':'men';

  let official=null;
  if(slug&&name){
    official=await fetchWorldRanking(slug,sexPath,name,athleteSlug,knownRank,diagnostics);
  }

  let estimatedNewRank=null;
  if(slug&&official?.page&&validScore(newScore)){
    estimatedNewRank=await estimateNewRankPositionWA(slug,sexPath,newScore,name,athleteSlug,official.page,diagnostics);
  }

  if(official&&official.score!=null){
    return json({
      ok:true,id:Number(id),event,name,
      rank:official.place||knownRank||null,
      rankScope:'world',
      score:official.score,
      source:'World Athletics world ranking',
      sourceUrl:`https://worldathletics.org/world-rankings/${slug}/${sexPath}`,
      verifiedPublished:true,
      basisVerified:false,
      basis:[],
      estimatedNewRank,
      diagnostics
    });
  }

  return json({ok:true,id:Number(id),event,name,rank:knownRank,rankScope:knownRank?'world':null,score:null,verifiedPublished:false,basisVerified:false,basis:[],estimatedNewRank,diagnostics});
}

function decode(v){return String(v||'').replace(/\\u0026/g,'&').replace(/\\u003c/g,'<').replace(/\\u003e/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');}

async function fetchRankingPage(slug,sexPath,page,diagnostics){
  const pageUrl=new URL(`https://worldathletics.org/world-rankings/${slug}/${sexPath}`);
  if(page>1)pageUrl.searchParams.set('page',String(page));
  let html='';
  try{
    const r=await fetchWithTimeout(pageUrl.toString(),{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/1.0'}});
    if(r.ok)html=await r.text();
    diagnostics.push({source:'wa-world-rankings',url:pageUrl.toString(),page,status:r.status,htmlLength:html.length});
    if(!r.ok)return null;
  }catch(e){
    diagnostics.push({source:'wa-world-rankings',url:pageUrl.toString(),page,error:String(e?.message||e)});
    return null;
  }
  const m=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!m){
    diagnostics.push({source:'wa-world-rankings-shape',page,hasNextData:false,htmlSample:html.slice(0,600)});
    return null;
  }
  let data;
  try{data=JSON.parse(decode(m[1]));}catch(e){
    diagnostics.push({source:'wa-world-rankings-shape',page,parseError:String(e?.message||e),nextDataSample:decode(m[1]).slice(0,600)});
    return null;
  }
  return data;
}

// The exact JSON shape of this page is unconfirmed - rather than hardcoding one guessed path
// into the __NEXT_DATA__ tree, this walks the whole tree looking for an array of many similarly-
// shaped objects that each look like a ranking row (a place/rank field + a name field + a score
// field), which should survive minor differences in exactly where WA nests the list.
function findRankingArrays(node,out,seen){
  if(!node||typeof node!=='object')return;
  if(seen.has(node))return;
  seen.add(node);
  if(Array.isArray(node)){
    if(node.length>=10){
      const sample=node.find(x=>x&&typeof x==='object');
      if(sample){
        const keys=Object.keys(sample).map(k=>k.toLowerCase());
        const hasPlace=keys.some(k=>['place','rank','position'].includes(k));
        const hasScore=keys.some(k=>['score','rankingscore','points'].includes(k));
        const hasName=keys.some(k=>['competitor','athlete','name','competitorname','athletename'].includes(k));
        if(hasPlace&&hasScore&&hasName){out.push(node);return;}
      }
    }
    for(const x of node)findRankingArrays(x,out,seen);
    return;
  }
  for(const v of Object.values(node))findRankingArrays(v,out,seen);
}
function rowField(row,names){
  if(!row||typeof row!=='object')return null;
  for(const n of names){
    const found=Object.keys(row).find(k=>k.toLowerCase()===n);
    if(found&&row[found]!=null)return row[found];
  }
  return null;
}
function rowPlace(row){const v=rowField(row,['place','rank','position']);const n=Number(v);return Number.isFinite(n)?n:null;}
function rowScore(row){const v=rowField(row,['score','rankingscore','points']);const n=Number(v);return Number.isFinite(n)?n:null;}
function rowName(row){
  const direct=rowField(row,['competitorname','athletename','name']);
  if(typeof direct==='string')return direct;
  const nested=rowField(row,['competitor','athlete']);
  if(nested&&typeof nested==='object'){
    if(typeof nested.name==='string')return nested.name;
    const first=nested.firstName||nested.givenName||'';
    const last=nested.lastName||nested.familyName||'';
    const full=`${first} ${last}`.trim();
    if(full)return full;
  }
  return null;
}
function rowSlug(row){const v=rowField(row,['urlslug','athleteurlslug','slug']);return typeof v==='string'?v:'';}
function athleteMatchesRow(row,wantedName,wantedSlug){
  const rs=rowSlug(row);
  if(wantedSlug&&rs&&rs===wantedSlug)return true;
  const rn=normalizeName(rowName(row)),wn=normalizeName(wantedName);
  return rn===wn||(rn&&wn&&(rn.includes(wn)||wn.includes(rn)));
}

async function fetchWorldRanking(slug,sexPath,name,athleteSlug,knownRank,diagnostics){
  const first=await fetchRankingPage(slug,sexPath,1,diagnostics);
  if(!first)return null;
  const arrays=[];
  findRankingArrays(first,arrays,new Set());
  const rows1=arrays[0]||[];
  diagnostics.push({source:'wa-world-rankings-shape',page:1,arraysFound:arrays.length,rowCount:rows1.length,sampleRow:rows1[0]||null});
  if(!rows1.length)return null;
  const pageSize=rows1.length;

  let row=rows1.find(r=>athleteMatchesRow(r,name,athleteSlug));
  if(row)return {row,page:1,place:rowPlace(row),score:rowScore(row)};

  // Targeted guess from knownRank/pageSize first (cheap if right), then a forward scan as
  // fallback, bounded by a fetch budget rather than an unknown total-page count - this page's
  // own pagination metadata (if any) isn't confirmed yet, see the shape diagnostics above.
  const guess=validRank(knownRank)?Math.max(2,Math.ceil(knownRank/pageSize)):2;
  const tried=new Set([1]);
  let budget=15;
  for(const page of [guess,guess-1,guess+1,guess-2,guess+2].filter(p=>p>=2&&!tried.has(p))){
    if(budget<=0)break;
    tried.add(page);budget--;
    const data=await fetchRankingPage(slug,sexPath,page,diagnostics);
    if(!data)continue;
    const arr=[];findRankingArrays(data,arr,new Set());
    const rows=arr[0]||[];
    row=rows.find(r=>athleteMatchesRow(r,name,athleteSlug));
    diagnostics.push({source:'wa-world-rankings-targeted',page,count:rows.length,found:!!row});
    if(row)return {row,page,place:rowPlace(row),score:rowScore(row)};
  }
  for(let page=2;budget>0;page++){
    if(tried.has(page))continue;
    tried.add(page);budget--;
    const data=await fetchRankingPage(slug,sexPath,page,diagnostics);
    if(!data){diagnostics.push({source:'wa-world-rankings-fullscan',page,found:false,stoppedNoData:true});break;}
    const arr=[];findRankingArrays(data,arr,new Set());
    const rows=arr[0]||[];
    if(!rows.length){diagnostics.push({source:'wa-world-rankings-fullscan',page,found:false,emptyPage:true});break;}
    row=rows.find(r=>athleteMatchesRow(r,name,athleteSlug));
    if(row){
      diagnostics.push({source:'wa-world-rankings-fullscan',page,found:true});
      return {row,page,place:rowPlace(row),score:rowScore(row)};
    }
  }
  diagnostics.push({source:'wa-world-rankings-fullscan',found:false,exhaustedBudget:true});
  return null;
}

// Same crossover-page-walk idea as before, just against WA's own real page instead of EA's -
// seeded from the athlete's CONFIRMED current page (seedPage, from fetchWorldRanking above), not
// a rank/pageSize guess, for the same reason that mattered last time: a rank number doesn't
// reliably predict a page number unless it's actually been confirmed against this same list.
async function estimateNewRankPositionWA(slug,sexPath,newScore,name,athleteSlug,seedPage,diagnostics){
  const pages={};
  async function getPage(p){
    if(pages[p]!==undefined)return pages[p];
    const data=await fetchRankingPage(slug,sexPath,p,diagnostics);
    const arr=[];if(data)findRankingArrays(data,arr,new Set());
    const rows=arr[0]||null;
    pages[p]=rows;
    return rows;
  }
  const seed=Number.isFinite(seedPage)&&seedPage>=1?seedPage:1;
  const visited=new Set();
  const budget=12;
  let fetches=0,crossoverPage=null;

  outer:
  for(let radius=0;radius<=40&&fetches<budget;radius++){
    const candidates=radius===0?[seed]:[seed-radius,seed+radius];
    for(const p of candidates){
      if(p<1||visited.has(p))continue;
      visited.add(p);fetches++;
      const rows=await getPage(p);
      if(!rows||!rows.length)continue;
      const scores=rows.map(rowScore).filter(Number.isFinite);
      if(!scores.length)continue;
      const top=scores[0],bottom=scores[scores.length-1];
      if((newScore<=top&&newScore>=bottom)||(p===1&&newScore>top)){crossoverPage=p;break outer;}
      if(newScore<bottom&&!pages[p+1]){continue;} // still worse than this whole page - keep expanding
    }
  }

  if(!crossoverPage){
    diagnostics.push({source:'wa-world-rankings-estimate',seed,fetches,found:false});
    return null;
  }

  const rows=pages[crossoverPage]||[];
  const pageSize=rows.length;
  const isAthlete=r=>athleteMatchesRow(r,name,athleteSlug);
  const betterOnPage=rows.filter(r=>!isAthlete(r)&&(rowScore(r)||0)>newScore).length;
  let position=(crossoverPage-1)*pageSize+betterOnPage+1;
  for(const p of Object.keys(pages)){
    if(Number(p)<crossoverPage&&pages[p]&&pages[p].some(isAthlete))position-=1;
  }
  diagnostics.push({source:'wa-world-rankings-estimate',seed,crossoverPage,betterOnPage,fetches,position});
  return position;
}

function rankingSlug(c){return ({'100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m','100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',HJ:'high-jump',PV:'pole-vault',LJ:'long-jump',TJ:'triple-jump',SP:'shot-put',DT:'discus-throw',HT:'hammer-throw',JT:'javelin-throw',Decathlon:'decathlon',Heptathlon:'heptathlon'})[c]||'';}
function rankingEventMatches(g,c){const n=norm(g),a={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon','combinedevents','combinedevent'],Heptathlon:['heptathlon','combinedevents','combinedevent']};return (a[c]||[]).some(x=>n===x||n.startsWith(x)||n.includes(x));}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a').replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=500&&n<=1800;}
function validRank(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<10000;}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
