// Fetches an athlete's real World Athletics world rank for an event, straight from WA's own
// backend via nimarion (confirmed by reading nimarion's own source: athlete.query.ts's
// getSingleCompetitor GraphQL query requests `worldRankings.current.place` directly from
// worldathletics.org's GraphQL API - not a mirror, not an estimate). Previously this endpoint
// also pulled a "Ranking Score" and rank from api.european-athletics.com's tRPC gateway, but live
// diagnostics proved that list is a different, smaller population (an athlete's real WA world
// rank was 3532nd, while that list - despite a proc misleadingly named "worldAthletics.getRanking"
// - only had ~1800 rows total and still found him around 1250th: consistent with a Europe-only
// list, not the world). That EA dependency is removed entirely - this app already computes the
// Ranking Score itself, locally, from 100% WA-sourced raw results (see ranking-basis.js's
// basisFor(), fed by /api/wa-results, also a direct nimarion/WA source) using WA's own published
// Result Score + Placing Score formula - nothing here needs to also reach EA for that number.
export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  if(!id)return json({ok:false,error:'Ugyldig World Athletics-ID'},400);
  if(!event)return json({ok:false,error:'Mangler øvelse'},400);

  const diagnostics=[];
  let name='',rank=null;
  try{
    const r=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.23.0','Accept':'application/json'}});
    if(r.ok){
      const profile=await r.json();
      name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
      const current=Array.isArray(profile?.currentWorldRankings)?profile.currentWorldRankings:[];
      const hit=current.find(x=>rankingEventMatches(x?.eventGroup,event));
      const p=Number(hit?.place);
      if(Number.isFinite(p)&&p>0&&p<100000)rank=p;
      diagnostics.push({source:'nimarion-profile',status:r.status,name,rank,eventGroup:hit?.eventGroup||null,allEventGroups:current.map(x=>x?.eventGroup)});
    }else diagnostics.push({source:'nimarion-profile',status:r.status});
  }catch(e){diagnostics.push({source:'nimarion-profile',error:String(e?.message||e)});}

  return json({ok:true,id:Number(id),event,name,rank,source:'World Athletics (via nimarion)',diagnostics});
}

function rankingEventMatches(g,c){const n=norm(g),a={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon','combinedevents','combinedevent'],Heptathlon:['heptathlon','combinedevents','combinedevent']};return (a[c]||[]).some(x=>n===x||n.startsWith(x)||n.includes(x));}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
