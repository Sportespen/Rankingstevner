const WA_GRAPHQL='https://graphql-prod-4746.prod.aws.worldathletics.org/graphql';
const WA_API_KEY='da2-fcprvsdozzce5dx2baifenjwpu';

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  if(!id)return json({ok:false,error:'invalid id'},400);

  let profile=null;
  try{
    const nr=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'accept':'application/json','user-agent':'Mozilla/5.0 Rankingstevner-Debug'}});
    if(nr.ok)profile=await nr.json();
  }catch(e){profile={_error:String(e?.message||e)}}

  const name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
  const slugs=[profile?.urlSlug,profile?.slug,slugify(name),'athlete'].map(x=>String(x||'').trim()).filter(Boolean);
  const unique=[...new Set(slugs)];

  const query=`query DebugAthleteRanking($id: Int, $urlSlug: String!) {
    getCISSingleCompetitor(id: $id, urlSlug: $urlSlug) {
      basicData { firstName lastName iaafId urlSlug }
      worldRankings { current { rankingCalculationId eventGroup male urlSlug place rankingScore } }
    }
  }`;

  const attempts=[];
  for(const slug of unique){
    try{
      const gr=await fetch(WA_GRAPHQL,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'accept':'application/json',
          'x-api-key':WA_API_KEY,
          'x-amz-user-agent':'aws-amplify/3.0.2',
          'user-agent':'Mozilla/5.0 Rankingstevner-Debug'
        },
        body:JSON.stringify({query,operationName:'DebugAthleteRanking',variables:{id:Number(id),urlSlug:slug}})
      });
      const text=await gr.text();
      let payload=null;try{payload=JSON.parse(text)}catch(_){payload={raw:text.slice(0,2000)}}
      attempts.push({slug,http:gr.status,payload});
      const athlete=payload?.data?.getCISSingleCompetitor;
      if(athlete?.worldRankings?.current?.length){
        return json({ok:true,id:Number(id),profile,name,slugUsed:slug,basicData:athlete.basicData,current:athlete.worldRankings.current,attempts});
      }
    }catch(e){attempts.push({slug,error:String(e?.message||e)})}
  }

  return json({ok:false,id:Number(id),profile,name,attempts},502);
}

function slugify(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/gi,'o').replace(/æ/gi,'ae').replace(/å/gi,'a').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
