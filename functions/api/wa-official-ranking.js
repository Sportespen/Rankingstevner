const EA_TRPC='https://api.european-athletics.com/trpc';

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  const sex=(url.searchParams.get('sex')||'').trim().toUpperCase();
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
  if(slug&&name){
    const official=await fetchOfficialRanking(slug,gender,name,athleteSlug,knownRank,diagnostics);
    if(official){
      const calc=await fetchOfficialCalculation(official.row.id,diagnostics);
      const basis=Array.isArray(calc?.results)?calc.results.map(normalizeBasis).filter(Boolean):[];
      return json({
        ok:true,id:Number(id),event,name,
        rank:Number(official.row.worldPlace)||Number(official.row.place)||knownRank,
        score:Number(official.row.rankingScore),
        rankDate:official.rankDate||null,
        source:'World Athletics official ranking data',
        sourceUrl:`https://worldathletics.org/world-rankings/${slug}/${sex==='W'?'m':'men'}`,
        verifiedPublished:true,
        basisVerified:basis.length>0,
        averagePerformanceScore:Number(calc?.averagePerformanceScore)||null,
        calculationId:Number(official.row.id)||null,
        basis,
        diagnostics
      });
    }
  }

  return json({ok:true,id:Number(id),event,name,rank:knownRank,score:null,verifiedPublished:false,basisVerified:false,basis:[],diagnostics});
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
