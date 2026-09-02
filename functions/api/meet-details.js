// Switched from the nimarion proxy (which only mirrors contact/prize/link fields) to WA's own
// public GraphQL API - the exact request their own calendar page makes when you click the "i"
// icon on a meet (operation "GetCompetitionOrganiserInfo"), captured live via browser DevTools.
// The x-api-key below is the same key WA's own frontend sends to every visitor (visible in any
// browser's Network tab) for this public, read-only endpoint - not a private credential.
// This also exposes `units` (the per-gender list of events actually being staged), which the
// nimarion proxy never had - confirmed via a Swagger dump earlier this project that its surface
// is only /competitions, /organiser and /results, with no per-meet schedule endpoint.
const WA_GRAPHQL='https://graphql-prod-4881.edge.aws.worldathletics.org/graphql';
const WA_API_KEY='da2-wbnmtmvlpbhifh3uc2xaxsue5i';
const QUERY=`query GetCompetitionOrganiserInfo($competitionId: Int!) {
  getCompetitionOrganiserInfo(competitionId: $competitionId) {
    liveStreamingUrl
    resultsPageUrl
    websiteUrl
    additionalInfo
    units {
      events
      gender
      __typename
    }
    prizeMoney {
      gender
      prizes
      __typename
    }
    contactPersons {
      email
      name
      phoneNumber
      title
      __typename
    }
    __typename
  }
}
`;

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const id=(url.searchParams.get('id')||'').trim();
  if(!/^\d+$/.test(id)) return json({ok:false,error:'Ugyldig stevne-ID'},400);
  try{
    const res=await fetch(WA_GRAPHQL,{
      method:'POST',
      headers:{'content-type':'application/json','accept':'*/*','x-api-key':WA_API_KEY},
      body:JSON.stringify({operationName:'GetCompetitionOrganiserInfo',variables:{competitionId:Number(id)},query:QUERY}),
    });
    if(!res.ok) return json({ok:false,error:`WA-kilde ${res.status}`},502);
    const payload=await res.json();
    if(Array.isArray(payload?.errors)&&payload.errors.length) return json({ok:false,error:payload.errors[0]?.message||'WA GraphQL-feil'},502);
    const info=payload?.data?.getCompetitionOrganiserInfo;
    if(!info) return json({ok:true,details:{}});
    // Keep the field names the frontend already used for the nimarion payload (name/email/phone,
    // resultsUrl, liveStreamUrl) so meet-finder-v1.js's existing rendering keeps working unchanged
    // - only `eventsProgram` is new.
    const contactPersons=(Array.isArray(info.contactPersons)?info.contactPersons:[]).map(c=>({name:c?.name||'',email:c?.email||'',phone:c?.phoneNumber||'',title:c?.title||''}));
    const prizeMoney=Object.fromEntries((Array.isArray(info.prizeMoney)?info.prizeMoney:[]).filter(p=>p?.prizes).map(p=>[p.gender||'',p.prizes]));
    const eventsProgram=(Array.isArray(info.units)?info.units:[]).map(u=>({gender:u?.gender||'',events:Array.isArray(u?.events)?u.events:[]})).filter(u=>u.events.length);
    return json({ok:true,details:{
      websiteUrl:info.websiteUrl||'',
      resultsUrl:info.resultsPageUrl||'',
      liveStreamUrl:info.liveStreamingUrl||'',
      additionalInfo:info.additionalInfo||'',
      contactPersons,
      prizeMoney,
      eventsProgram,
    }});
  }catch(e){return json({ok:false,error:String(e?.message||e)},502)}
}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600'}})}
