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

// Same two fixes applied to wa-rank.js after a live incident: (1) a hard deadline, since a hung
// fetch with no timeout gets killed by Cloudflare's own platform limit instead of ever reaching
// our catch block; (2) never returning HTTP 502 to the browser - Cloudflare's edge intercepts that
// status from a Pages Function and replaces our own {ok:false} JSON with its generic error page.
// The frontend (meet-finder-v1.js) already reads the `ok` field, not the HTTP status.
const FETCH_TIMEOUT_MS=6000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{ return await fetch(url,{...options,signal:controller.signal}); }
  finally{ clearTimeout(timer); }
}
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
    const res=await fetchWithTimeout(WA_GRAPHQL,{
      method:'POST',
      headers:{'content-type':'application/json','accept':'*/*','x-api-key':WA_API_KEY},
      body:JSON.stringify({operationName:'GetCompetitionOrganiserInfo',variables:{competitionId:Number(id)},query:QUERY}),
    });
    if(!res.ok) return json({ok:false,error:`WA-kilde ${res.status}`});
    const payload=await res.json();
    if(Array.isArray(payload?.errors)&&payload.errors.length) return json({ok:false,error:payload.errors[0]?.message||'WA GraphQL-feil'});
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
  }catch(e){return json({ok:false,error:String(e?.message||e)})}
}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600'}})}
