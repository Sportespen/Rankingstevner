const WA_GRAPHQL='https://graphql-prod-4746.prod.aws.worldathletics.org/graphql';
const WA_API_KEY='da2-fcprvsdozzce5dx2baifenjwpu';

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  if(!id)return json({ok:false,error:'Ugyldig World Athletics-ID'},400);
  if(!event)return json({ok:false,error:'Mangler øvelse'},400);

  try{
    let name='', athleteSlug='';
    try{
      const nr=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.2','Accept':'application/json'}});
      if(nr.ok){const a=await nr.json();name=`${a?.firstname||a?.firstName||''} ${a?.lastname||a?.lastName||''}`.trim();athleteSlug=String(a?.urlSlug||a?.slug||'').trim();}
    }catch(_){ }
    if(!athleteSlug)athleteSlug=slugify(name);

    // WA sitt getCISSingleCompetitor-oppslag bruker iaafId som String.
    const query=`query OfficialAthleteRanking($id: String, $urlSlug: String!) {
      getCISSingleCompetitor(iaafId: $id, urlSlug: $urlSlug) {
        basicData { firstName lastName iaafId urlSlug }
        worldRankings { current { eventGroup place rankingScore } }
      }
    }`;
    const variables={id:String(id),urlSlug:athleteSlug||'athlete'};
    const gr=await fetch(WA_GRAPHQL,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','x-api-key':WA_API_KEY,'x-amz-user-agent':'aws-amplify/3.0.2','user-agent':'Mozilla/5.0 Rankingstevner/0.20.2'},body:JSON.stringify({query,operationName:'OfficialAthleteRanking',variables})});
    const payload=await gr.json().catch(()=>null);
    if(!gr.ok||payload?.errors?.length)return json({ok:false,error:'World Athletics svarte ikke med rankingdata',detail:payload?.errors?.[0]?.message||`HTTP ${gr.status}`},502);

    const athlete=payload?.data?.getCISSingleCompetitor;
    const basic=athlete?.basicData||{};
    if(!name)name=`${basic.firstName||''} ${basic.lastName||''}`.trim();
    const current=Array.isArray(athlete?.worldRankings?.current)?athlete.worldRankings.current:[];
    const hit=current.find(r=>rankingEventMatches(r?.eventGroup,event));
    const rank=Number(hit?.place),score=Number(hit?.rankingScore);
    return json({ok:true,id:Number(id),event,name,rank:Number.isFinite(rank)&&rank>0?rank:null,score:Number.isFinite(score)&&score>0?score:null,source:'World Athletics GraphQL',eventGroup:hit?.eventGroup||null,count:current.length});
  }catch(e){return json({ok:false,error:'Kunne ikke hente offisiell WA Ranking Score',detail:String(e?.message||e)},502);}
}

function rankingEventMatches(eventGroup,code){
  const n=norm(eventGroup);
  const aliases={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon'],Heptathlon:['heptathlon','combinedevents','combinedevent']};
  return (aliases[code]||[]).some(a=>n===a||n.startsWith(a)||n.includes(a));
}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function slugify(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/gi,'o').replace(/æ/gi,'ae').replace(/å/gi,'a').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
