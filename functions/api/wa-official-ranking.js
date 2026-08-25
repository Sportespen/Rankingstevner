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

  try{
    const nr=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.6','Accept':'application/json'}});
    if(nr.ok){
      profile=await nr.json();
      name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
    }
  }catch(e){diagnostics.push({source:'nimarion-profile',error:String(e?.message||e)});}

  // 1) Bruk samme getSingleCompetitor-spørring som Nimarion bruker mot WA.
  // Vi ber i tillegg om rankingScore, som er verdien vi trenger.
  try{
    const query=`query OfficialAthleteRanking($id: Int) {
      getSingleCompetitor(id: $id) {
        basicData { familyName givenName }
        worldRankings { current { eventGroup place rankingScore } }
      }
    }`;
    const variables={id:Number(id)};
    const gr=await fetch(WA_GRAPHQL,{method:'POST',headers:{
      'content-type':'application/json','accept':'application/json','x-api-key':WA_API_KEY,
      'x-amz-user-agent':'aws-amplify/3.0.2','user-agent':'Mozilla/5.0 Rankingstevner/0.20.6'
    },body:JSON.stringify({query,operationName:'OfficialAthleteRanking',variables})});
    const text=await gr.text();
    let payload=null;try{payload=JSON.parse(text);}catch(_){ }
    const athlete=payload?.data?.getSingleCompetitor;
    const current=Array.isArray(athlete?.worldRankings?.current)?athlete.worldRankings.current:[];
    diagnostics.push({source:'graphql-getSingleCompetitor',status:gr.status,error:payload?.errors?.[0]?.message||null,currentCount:current.length,bodyPreview:payload?undefined:text.slice(0,500)});
    if(!name){const b=athlete?.basicData||{};name=`${b.givenName||''} ${b.familyName||''}`.trim();}
    const hit=current.find(r=>rankingEventMatches(r?.eventGroup,event));
    const rank=Number(hit?.place),score=Number(hit?.rankingScore);
    if(validScore(score)){
      return json({ok:true,id:Number(id),event,name,rank:validRank(rank)?rank:null,score,source:'World Athletics GraphQL',eventGroup:hit?.eventGroup||null,diagnostics});
    }
  }catch(e){diagnostics.push({source:'graphql-getSingleCompetitor',error:String(e?.message||e)});}

  // 2) Nimarion gir stabilt plassering/eventGroup. Bruk dette som kontrollgrunnlag.
  try{
    const rankings=Array.isArray(profile?.currentWorldRankings)?profile.currentWorldRankings:[];
    const rhit=rankings.find(r=>rankingEventMatches(r?.eventGroup,event));
    const knownRank=Number(rhit?.place);
    diagnostics.push({source:'nimarion',matchedEventGroup:rhit?.eventGroup||null,knownRank:validRank(knownRank)?knownRank:null});

    // 3) Kun én forsiktig reserve mot offentlig WA-tabell for å unngå 429-spam.
    if(validRank(knownRank)&&name){
      const slug=rankingSlug(event);
      if(slug){
        const page=Math.max(1,Math.ceil(knownRank/100));
        const path=sex==='W'?'m':'men';
        const rankingUrl=`https://worldathletics.org/world-rankings/${slug}/${path}?page=${page}`;
        const readerUrl=`https://r.jina.ai/${rankingUrl}`;
        const rr=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.6','Accept':'text/plain'}}).catch(()=>null);
        const tableText=rr?.ok?await rr.text():'';
        const found=findAthleteRow(tableText,name,knownRank);
        diagnostics.push({source:'ranking-table',path,page,status:rr?.status||null,foundRank:found?.rank||null,foundScore:found?.score||null});
        if(found&&validScore(found.score)){
          return json({ok:true,id:Number(id),event,name,rank:found.rank||knownRank,score:found.score,source:'World Athletics ranking table',eventGroup:rhit?.eventGroup||null,diagnostics});
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
  for(const line of lines){
    if(!line.includes('|')||!normalizeName(line).includes(wanted))continue;
    const cols=line.split('|').map(s=>s.trim()).filter(Boolean);
    if(cols.length<5)continue;
    const rank=Number(String(cols[0]).replace(/\D/g,''));
    const score=Number(String(cols[4]).replace(/[^0-9]/g,''));
    if(validRank(rank)&&validScore(score)&&Math.abs(rank-knownRank)<=5)return {rank,score};
  }
  return null;
}
function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=500&&n<=1800;}
function validRank(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<10000;}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
