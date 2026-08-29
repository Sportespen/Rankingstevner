const EA_TRPC='https://api.european-athletics.com/trpc';

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
    const r=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.22.1','Accept':'application/json'}});
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
  const gender=sex==='W'?'women':'men';

  // fetchOfficialRanking runs first: it already falls back to a full page scan when a seed
  // guess misses, so it can find the athlete even off a bad starting rank.
  let official=null;
  if(slug&&name){
    official=await fetchOfficialRanking(slug,gender,name,athleteSlug,knownRank,diagnostics);
  }
  // `europeanRank` (this athlete's position within the EA_TRPC list) is NOT the same figure as
  // `knownRank` (nimarion's `worldRankings.current.place`, sourced directly from World
  // Athletics' own GraphQL backend - confirmed by reading nimarion's own source, see
  // athlete.query.ts's getSingleCompetitor query). Live diagnostics proved these are genuinely
  // different populations, not just noise: one athlete's real WA world rank (knownRank) was
  // 3532nd, yet the EA_TRPC list - despite its proc being misleadingly named
  // "worldAthletics.getRanking" - only has ~1800 rows total and still found him on page 13
  // (~1250th). A European sprinter placing far better among Europeans only than among the
  // entire world is exactly what you'd expect if that list is Europe-scoped - which is also
  // what the "european-athletics.com" domain itself is. Labelling that list's rank/position as
  // "i verden" (world rank) was therefore reporting a real number under the wrong scope - not a
  // guess, an actually different ranking population. `europeanRank` is kept and exposed
  // separately (still genuinely useful - it IS this athlete's real European standing), but the
  // GLOBAL claim now comes from `knownRank` (nimarion/WA) whenever available.
  const europeanRank=Number(official?.row?.worldPlace)||Number(official?.row?.place)||null;
  const seedRank=validRank(europeanRank)?europeanRank:knownRank;

  // The estimated NEW position for a hypothetical result can only ever be computed by walking
  // the EA_TRPC list (nimarion exposes no full ranking list to walk, only a single current-place
  // snapshot per athlete) - so this is unavoidably a European-scoped estimate too, seeded from
  // the athlete's already-confirmed position within that SAME list (seedRank), never nimarion's
  // global rank, which wouldn't correspond to a page number in this list at all.
  let estimatedNewEuropeanRank=null;
  if(slug&&name&&validScore(newScore)){
    estimatedNewEuropeanRank=await estimateNewRankPosition(slug,gender,newScore,name,athleteSlug,seedRank,diagnostics);
  }

  if(official){
    const calc=await fetchOfficialCalculation(official.row.id,diagnostics);
    const basis=Array.isArray(calc?.results)?calc.results.map(normalizeBasis).filter(Boolean):[];
    return json({
      ok:true,id:Number(id),event,name,
      rank:validRank(knownRank)?knownRank:europeanRank,
      rankScope:validRank(knownRank)?'world':(europeanRank?'europe':null),
      europeanRank,
      score:Number(official.row.rankingScore),
      rankDate:official.rankDate||null,
      source:'World Athletics official ranking data',
      sourceUrl:`https://worldathletics.org/world-rankings/${slug}/${sex==='W'?'m':'men'}`,
      verifiedPublished:true,
      basisVerified:basis.length>0,
      averagePerformanceScore:Number(calc?.averagePerformanceScore)||null,
      calculationId:Number(official.row.id)||null,
      basis,
      estimatedNewEuropeanRank,
      diagnostics
    });
  }

  return json({ok:true,id:Number(id),event,name,rank:knownRank,rankScope:knownRank?'world':null,europeanRank:null,score:null,verifiedPublished:false,basisVerified:false,basis:[],estimatedNewEuropeanRank,diagnostics});
}

// A single simulated result won't jump an athlete across the whole ranking list, so start
// looking near their current position (like fetchOfficialRanking's byWorldRank guess) and
// walk outward page by page until the page whose score range straddles newScore is found.
// Pages are strictly descending in score, so every page walked past is fully "better than
// newScore" without needing to fetch it - only the crossover page's exact rows matter.
async function estimateNewRankPosition(slug,gender,newScore,name,athleteSlug,knownRank,diagnostics){
  let first;
  try{ first=await trpc('worldAthletics.getRanking',{eventGroup:slug,gender,page:1}); }
  catch(e){ diagnostics.push({source:'ea-ranking-estimate',page:1,error:String(e?.message||e)}); return null; }
  const rows1=Array.isArray(first?.rankings)?first.rankings:[];
  if(!rows1.length)return null;
  const pageSize=rows1.length;
  const maxPages=Math.max(1,Number(first?.pages)||1);
  const isAthlete=r=>athleteMatches(r,name,athleteSlug);

  const pages={1:rows1};
  async function getPage(p){
    if(p<1||p>maxPages)return null;
    if(pages[p])return pages[p];
    try{
      const d=await trpc('worldAthletics.getRanking',{eventGroup:slug,gender,page:p});
      const rows=Array.isArray(d?.rankings)?d.rankings:[];
      pages[p]=rows;
      return rows;
    }catch(e){diagnostics.push({source:'ea-ranking-estimate',page:p,error:String(e?.message||e)});return null;}
  }

  const seed=validRank(knownRank)?Math.max(1,Math.ceil(knownRank/pageSize)):1;
  const visited=new Set();
  const budget=12;
  let fetches=0,crossoverPage=null;

  outer:
  for(let radius=0;radius<=maxPages&&fetches<budget;radius++){
    const candidates=radius===0?[seed]:[seed-radius,seed+radius];
    for(const p of candidates){
      if(p<1||p>maxPages||visited.has(p))continue;
      visited.add(p);fetches++;
      const rows=await getPage(p);
      if(!rows||!rows.length)continue;
      const top=Number(rows[0]?.rankingScore),bottom=Number(rows[rows.length-1]?.rankingScore);
      if(!Number.isFinite(top)||!Number.isFinite(bottom))continue;
      if((newScore<=top&&newScore>=bottom)||(p===1&&newScore>top)||(p===maxPages&&newScore<bottom)){crossoverPage=p;break outer;}
    }
  }

  if(!crossoverPage){
    diagnostics.push({source:'ea-ranking-estimate',seed,fetches,found:false});
    return null;
  }

  const rows=pages[crossoverPage]||[];
  const betterOnPage=rows.filter(r=>!isAthlete(r)&&Number(r.rankingScore)>newScore).length;
  let position=(crossoverPage-1)*pageSize+betterOnPage+1;
  for(let p=1;p<crossoverPage;p++){
    if(pages[p]&&pages[p].some(isAthlete))position-=1;
  }
  diagnostics.push({source:'ea-ranking-estimate',seed,crossoverPage,betterOnPage,fetches,position});
  return position;
}

async function trpc(proc,input){
  const q=encodeURIComponent(JSON.stringify({json:input}));
  const r=await fetch(`${EA_TRPC}/${proc}?input=${q}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.22.1','Accept':'application/json'}});
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

async function fetchOfficialRanking(slug,gender,name,athleteSlug,knownRank,diagnostics){
  let first=null;
  try{
    first=await trpc('worldAthletics.getRanking',{eventGroup:slug,gender,page:1});
  }catch(e){diagnostics.push({source:'ea-ranking',slug,gender,page:1,error:String(e?.message||e)});return null;}

  const firstRows=Array.isArray(first?.rankings)?first.rankings:[];
  const maxPages=Math.max(1,Number(first?.pages)||1);
  const pageSize=Math.max(1,firstRows.length||100);
  let row=firstRows.find(r=>athleteMatches(r,name,athleteSlug));
  diagnostics.push({source:'ea-ranking',slug,gender,page:1,count:firstRows.length,pages:maxPages,pageSize,knownRank,found:!!row});
  if(row&&validScore(row.rankingScore))return {row,rankDate:first?.rankDate||null};

  const targets=[];
  if(validRank(knownRank)){
    const byWorldRank=Math.max(1,Math.ceil(Number(knownRank)/pageSize));
    for(const p of [byWorldRank,byWorldRank-1,byWorldRank+1,byWorldRank-2,byWorldRank+2]){
      if(p>=2&&p<=maxPages&&!targets.includes(p))targets.push(p);
    }
  }

  for(const page of targets){
    try{
      const data=await trpc('worldAthletics.getRanking',{eventGroup:slug,gender,page});
      const rows=Array.isArray(data?.rankings)?data.rankings:[];
      row=rows.find(r=>athleteMatches(r,name,athleteSlug));
      diagnostics.push({source:'ea-ranking-targeted',slug,gender,page,count:rows.length,found:!!row});
      if(row&&validScore(row.rankingScore))return {row,rankDate:data?.rankDate||first?.rankDate||null};
    }catch(e){diagnostics.push({source:'ea-ranking-targeted',slug,gender,page,error:String(e?.message||e)});}
  }

  // Fallback: scan the remaining pages. This is only used when the athlete's
  // world rank and the gateway's page order differ (common in deep sprint lists).
  for(let page=2;page<=maxPages;page++){
    if(targets.includes(page))continue;
    try{
      const data=await trpc('worldAthletics.getRanking',{eventGroup:slug,gender,page});
      const rows=Array.isArray(data?.rankings)?data.rankings:[];
      row=rows.find(r=>athleteMatches(r,name,athleteSlug));
      if(row&&validScore(row.rankingScore)){
        diagnostics.push({source:'ea-ranking-fullscan',slug,gender,page,found:true});
        return {row,rankDate:data?.rankDate||first?.rankDate||null};
      }
    }catch(e){diagnostics.push({source:'ea-ranking-fullscan',slug,gender,page,error:String(e?.message||e)});break;}
  }
  return null;
}

async function fetchOfficialCalculation(calculationId,diagnostics){
  if(!Number.isFinite(Number(calculationId)))return null;
  try{
    const data=await trpc('worldAthletics.getRankingScoreCalculation',{calculationId:Number(calculationId)});
    diagnostics.push({source:'ea-ranking-calculation',calculationId:Number(calculationId),count:Array.isArray(data?.results)?data.results.length:0,averagePerformanceScore:data?.averagePerformanceScore||null});
    return data||null;
  }catch(e){diagnostics.push({source:'ea-ranking-calculation',calculationId:Number(calculationId),error:String(e?.message||e)});return null;}
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
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a').replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=500&&n<=1800;}
function validRank(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<10000;}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
