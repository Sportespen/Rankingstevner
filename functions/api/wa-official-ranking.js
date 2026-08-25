const WA_GRAPHQL='https://graphql-prod-4746.prod.aws.worldathletics.org/graphql';

export async function onRequestGet(context){
  const WA_API_KEY=context?.env?.WA_API_KEY;
  if(!WA_API_KEY)return json({ok:false,error:'WA_API_KEY mangler i Cloudflare environment'},500);

  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  const sex=(url.searchParams.get('sex')||'').trim().toUpperCase();
  if(!id)return json({ok:false,error:'Ugyldig World Athletics-ID'},400);
  if(!event)return json({ok:false,error:'Mangler øvelse'},400);

  let name='', athleteSlug='';
  try{
    const nr=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.4','Accept':'application/json'}});
    if(nr.ok){
      const a=await nr.json();
      name=`${a?.firstname||a?.firstName||''} ${a?.lastname||a?.lastName||''}`.trim();
      athleteSlug=String(a?.urlSlug||a?.slug||'').trim();
    }
  }catch(_){ }
  if(!athleteSlug)athleteSlug=slugify(name);

  const diagnostics=[];

  try{
    const query=`query OfficialAthleteRanking($id: Int, $urlSlug: String!) {
      getCISSingleCompetitor(id: $id, urlSlug: $urlSlug) {
        basicData { firstName lastName iaafId urlSlug }
        worldRankings { current { rankingCalculationId eventGroup male urlSlug place rankingScore } }
      }
    }`;
    const variables={id:Number(id),urlSlug:athleteSlug||'athlete'};
    const gr=await fetch(WA_GRAPHQL,{
      method:'POST',
      headers:{
        'content-type':'application/json','accept':'application/json',
        'x-api-key':WA_API_KEY,'x-amz-user-agent':'aws-amplify/3.0.2',
        'user-agent':'Mozilla/5.0 Rankingstevner/0.20.4'
      },
      body:JSON.stringify({query,operationName:'OfficialAthleteRanking',variables})
    });
    const payload=await gr.json().catch(()=>null);
    const current=Array.isArray(payload?.data?.getCISSingleCompetitor?.worldRankings?.current)
      ? payload.data.getCISSingleCompetitor.worldRankings.current
      : [];
    diagnostics.push({
      source:'graphql',status:gr.status,error:payload?.errors?.[0]?.message||null,
      slugSent:variables.urlSlug,
      currentCount:current.length,
      current:current.map(r=>({eventGroup:r?.eventGroup,place:r?.place,rankingScore:r?.rankingScore,male:r?.male,urlSlug:r?.urlSlug}))
    });
    const athlete=payload?.data?.getCISSingleCompetitor;
    const basic=athlete?.basicData||{};
    if(!name)name=`${basic.firstName||''} ${basic.lastName||''}`.trim();
    const hit=current.find(r=>rankingEventMatches(r?.eventGroup,event));
    const rank=Number(hit?.place),score=Number(hit?.rankingScore);
    if(Number.isFinite(score)&&score>0){
      return json({ok:true,id:Number(id),event,name,rank:Number.isFinite(rank)&&rank>0?rank:null,score,source:'World Athletics GraphQL',eventGroup:hit?.eventGroup||null,diagnostics});
    }
  }catch(e){diagnostics.push({source:'graphql',error:String(e?.message||e)});}

  try{
    const rankInfo=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.4','Accept':'application/json'}}).then(r=>r.ok?r.json():null).catch(()=>null);
    const rankings=Array.isArray(rankInfo?.currentWorldRankings)?rankInfo.currentWorldRankings:[];
    const rhit=rankings.find(r=>rankingEventMatches(r?.eventGroup,event));
    const knownRank=Number(rhit?.place);
    diagnostics.push({source:'nimarion',currentWorldRankings:rankings});
    if(Number.isFinite(knownRank)&&knownRank>0){
      const slug=rankingSlug(event);
      const page=Math.max(1,Math.ceil(knownRank/100));
      const sexPath=sex==='W'?'women':'men';
      const variants=[
        `https://worldathletics.org/world-rankings/${slug}/null?page=${page}`,
        `https://worldathletics.org/world-rankings/${slug}/${sexPath}?page=${page}`
      ];
      for(const rankingUrl of variants){
        const u=new URL(rankingUrl);
        const readerUrl=`https://r.jina.ai/https://worldathletics.org${u.pathname}${u.search}`;
        const rr=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.4','Accept':'text/plain'}}).catch(()=>null);
        const text=rr?.ok?await rr.text():'';
        const score=findScore(text,name,knownRank);
        diagnostics.push({source:'ranking-table',rankingUrl,status:rr?.status||null,foundScore:score||null});
        if(Number.isFinite(score)&&score>0){
          return json({ok:true,id:Number(id),event,name,rank:knownRank,score,source:'World Athletics ranking table',eventGroup:rhit?.eventGroup||null,diagnostics});
        }
      }
    }
  }catch(e){diagnostics.push({source:'ranking-table',error:String(e?.message||e)});}

  return json({ok:true,id:Number(id),event,name,rank:null,score:null,source:'World Athletics',diagnostics});
}

function rankingSlug(code){
  return ({'100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m','100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',HJ:'high-jump',PV:'pole-vault',LJ:'long-jump',TJ:'triple-jump',SP:'shot-put',DT:'discus-throw',HT:'hammer-throw',JT:'javelin-throw',Decathlon:'decathlon',Heptathlon:'heptathlon'})[code]||'';
}
function rankingEventMatches(eventGroup,code){
  const n=norm(eventGroup);
  const aliases={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon','combinedevents','combinedevent'],Heptathlon:['heptathlon','combinedevents','combinedevent']};
  return (aliases[code]||[]).some(a=>n===a||n.startsWith(a)||n.includes(a));
}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a').replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function findScore(text,name,knownRank){
  if(!text||!name)return null;
  const wanted=normalizeName(name);
  const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(const line of lines){
    if(!line.includes('|')||!normalizeName(line).includes(wanted))continue;
    const cols=line.split('|').map(s=>s.trim()).filter(Boolean);
    if(cols.length<5)continue;
    const rowRank=Number(String(cols[0]).replace(/\D/g,''));
    if(rowRank!==knownRank)continue;
    const score=Number(String(cols[4]).replace(/[^0-9]/g,''));
    if(Number.isFinite(score)&&score>=500&&score<=1800)return score;
  }
  for(const line of lines){
    if(!normalizeName(line).includes(wanted))continue;
    const rankMatch=line.match(/^\s*(\d{1,4})\b/);
    if(rankMatch&&Number(rankMatch[1])!==knownRank)continue;
    const nums=[...line.matchAll(/\b(\d{3,4})\b/g)].map(m=>Number(m[1])).filter(v=>v>=500&&v<=1800);
    if(nums.length)return nums[nums.length-1];
  }
  return null;
}
function slugify(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/gi,'o').replace(/æ/gi,'ae').replace(/å/gi,'a').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
