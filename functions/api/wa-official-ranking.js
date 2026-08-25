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

  const diagnostics=[];
  let profile=null;
  let name='';
  let athleteSlug='';

  try{
    const nr=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.5','Accept':'application/json'}});
    if(nr.ok){
      profile=await nr.json();
      name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
      athleteSlug=String(profile?.urlSlug||profile?.slug||'').trim();
    }
  }catch(e){diagnostics.push({source:'nimarion-profile',error:String(e?.message||e)});}
  if(!athleteSlug)athleteSlug=slugify(name);

  // 1) Direkte WA GraphQL når dette er tilgjengelig.
  try{
    const query=`query OfficialAthleteRanking($id: Int, $urlSlug: String!) {
      getCISSingleCompetitor(id: $id, urlSlug: $urlSlug) {
        basicData { firstName lastName iaafId urlSlug }
        worldRankings { current { rankingCalculationId eventGroup male urlSlug place rankingScore } }
      }
    }`;
    const variables={id:Number(id),urlSlug:athleteSlug||'athlete'};
    const gr=await fetch(WA_GRAPHQL,{method:'POST',headers:{
      'content-type':'application/json','accept':'application/json','x-api-key':WA_API_KEY,
      'x-amz-user-agent':'aws-amplify/3.0.2','user-agent':'Mozilla/5.0 Rankingstevner/0.20.5'
    },body:JSON.stringify({query,operationName:'OfficialAthleteRanking',variables})});
    const payload=await gr.json().catch(()=>null);
    const current=Array.isArray(payload?.data?.getCISSingleCompetitor?.worldRankings?.current)?payload.data.getCISSingleCompetitor.worldRankings.current:[];
    diagnostics.push({source:'graphql',status:gr.status,error:payload?.errors?.[0]?.message||null,currentCount:current.length});
    const athlete=payload?.data?.getCISSingleCompetitor;
    if(!name){const b=athlete?.basicData||{};name=`${b.firstName||''} ${b.lastName||''}`.trim();}
    const hit=current.find(r=>rankingEventMatches(r?.eventGroup,event));
    const rank=Number(hit?.place),score=Number(hit?.rankingScore);
    if(validScore(score))return json({ok:true,id:Number(id),event,name,rank:validRank(rank)?rank:null,score,source:'World Athletics GraphQL',eventGroup:hit?.eventGroup||null,diagnostics});
  }catch(e){diagnostics.push({source:'graphql',error:String(e?.message||e)});}

  // 2) Stabil reserve: bruk Nimarion til å identifisere riktig øvelsesranking,
  // og les selve offisielle Ranking Score fra WA sin offentlige rankingtabell.
  try{
    const rankings=Array.isArray(profile?.currentWorldRankings)?profile.currentWorldRankings:[];
    const rhit=rankings.find(r=>rankingEventMatches(r?.eventGroup,event));
    const knownRank=Number(rhit?.place);
    diagnostics.push({source:'nimarion',matchedEventGroup:rhit?.eventGroup||null,knownRank:validRank(knownRank)?knownRank:null});

    if(validRank(knownRank)&&name){
      const slug=rankingSlug(event);
      if(slug){
        const basePage=Math.max(1,Math.ceil(knownRank/100));
        const pages=[basePage,Math.max(1,basePage-1),basePage+1].filter((v,i,a)=>a.indexOf(v)===i);
        const paths=sex==='W'?['m','women','null']:['men','m','null'];

        for(const page of pages){
          for(const path of paths){
            const rankingUrl=`https://worldathletics.org/world-rankings/${slug}/${path}?page=${page}`;
            const readerUrl=`https://r.jina.ai/${rankingUrl}`;
            const rr=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.5','Accept':'text/plain'}}).catch(()=>null);
            const text=rr?.ok?await rr.text():'';
            const found=findAthleteRow(text,name,knownRank);
            diagnostics.push({source:'ranking-table',path,page,status:rr?.status||null,foundRank:found?.rank||null,foundScore:found?.score||null});
            if(found&&validScore(found.score)){
              return json({ok:true,id:Number(id),event,name,rank:found.rank||knownRank,score:found.score,source:'World Athletics ranking table',eventGroup:rhit?.eventGroup||null,diagnostics});
            }
          }
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
function findAthleteRow(text,name,knownRank){
  if(!text||!name)return null;
  const wanted=normalizeName(name);
  const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

  // Markdown-tabell fra WA/Jina: Place | Competitor | DOB | Nation | Score | Event List
  for(const line of lines){
    if(!line.includes('|')||!normalizeName(line).includes(wanted))continue;
    const cols=line.split('|').map(s=>s.trim()).filter(Boolean);
    if(cols.length<5)continue;
    const rank=Number(String(cols[0]).replace(/\D/g,''));
    const score=Number(String(cols[4]).replace(/[^0-9]/g,''));
    if(validRank(rank)&&validScore(score)&&Math.abs(rank-knownRank)<=5)return {rank,score};
  }

  // Reserve for tekstformat uten ren markdown-tabell.
  for(const line of lines){
    if(!normalizeName(line).includes(wanted))continue;
    const nums=[...line.matchAll(/\b(\d{1,4})\b/g)].map(m=>Number(m[1]));
    const plausibleScores=nums.filter(v=>validScore(v));
    const plausibleRanks=nums.filter(v=>validRank(v)&&Math.abs(v-knownRank)<=5);
    if(plausibleScores.length&&plausibleRanks.length)return {rank:plausibleRanks[0],score:plausibleScores[plausibleScores.length-1]};
  }
  return null;
}
function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=500&&n<=1800;}
function validRank(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<10000;}
function slugify(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/gi,'o').replace(/æ/gi,'ae').replace(/å/gi,'a').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
