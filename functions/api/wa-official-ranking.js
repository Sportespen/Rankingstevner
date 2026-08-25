const WA_GRAPHQL_ENDPOINTS=[
  'https://graphql-prod-4877.edge.aws.worldathletics.org/graphql',
  'https://graphql-prod-4746.prod.aws.worldathletics.org/graphql'
];

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
    const nr=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.7','Accept':'application/json'}});
    if(nr.ok){
      profile=await nr.json();
      name=`${profile?.firstname||profile?.firstName||''} ${profile?.lastname||profile?.lastName||''}`.trim();
    }
  }catch(e){diagnostics.push({source:'nimarion-profile',error:String(e?.message||e)});}

  const query=`query OfficialAthleteRanking($id: Int) {
    getSingleCompetitor(id: $id) {
      basicData { familyName givenName }
      worldRankings { current { eventGroup place rankingScore } }
    }
  }`;
  const variables={id:Number(id)};

  for(const endpoint of WA_GRAPHQL_ENDPOINTS){
    try{
      const gr=await fetch(endpoint,{method:'POST',headers:{
        'content-type':'application/json','accept':'application/json','x-api-key':WA_API_KEY,
        'x-amz-user-agent':'aws-amplify/3.0.2','x-graphql-client-name':'worldathletics',
        'user-agent':'Mozilla/5.0 Rankingstevner/0.20.7'
      },body:JSON.stringify({query,operationName:'OfficialAthleteRanking',variables})});
      const text=await gr.text();
      let payload=null;try{payload=JSON.parse(text);}catch(_){ }
      const athlete=payload?.data?.getSingleCompetitor;
      const current=Array.isArray(athlete?.worldRankings?.current)?athlete.worldRankings.current:[];
      diagnostics.push({source:'graphql-getSingleCompetitor',endpoint,status:gr.status,error:payload?.errors?.[0]?.message||null,currentCount:current.length,bodyPreview:payload?undefined:text.slice(0,300)});
      if(!name){const b=athlete?.basicData||{};name=`${b.givenName||''} ${b.familyName||''}`.trim();}
      const hit=current.find(r=>rankingEventMatches(r?.eventGroup,event));
      const rank=Number(hit?.place),score=Number(hit?.rankingScore);
      if(validScore(score))return json({ok:true,id:Number(id),event,name,rank:validRank(rank)?rank:null,score,source:'World Athletics GraphQL',eventGroup:hit?.eventGroup||null,diagnostics});
    }catch(e){diagnostics.push({source:'graphql-getSingleCompetitor',endpoint,error:String(e?.message||e)});}
  }

  const rankings=Array.isArray(profile?.currentWorldRankings)?profile.currentWorldRankings:[];
  const rhit=rankings.find(r=>rankingEventMatches(r?.eventGroup,event));
  const knownRank=Number(rhit?.place);
  diagnostics.push({source:'nimarion',matchedEventGroup:rhit?.eventGroup||null,knownRank:validRank(knownRank)?knownRank:null});

  if(validRank(knownRank)&&name){
    const slug=rankingSlug(event);
    if(slug){
      const page=Math.max(1,Math.ceil(knownRank/100));
      const path=sex==='W'?'m':'men';
      const rankingUrl=`https://worldathletics.org/world-rankings/${slug}/${path}?page=${page}`;

      // Først prøver vi selve WA-siden direkte. Dette unngår Jina-rate-limit.
      try{
        const rr=await fetch(rankingUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.7','Accept':'text/html,application/xhtml+xml'}});
        const html=await rr.text();
        const found=findAthleteInHtml(html,name,knownRank);
        diagnostics.push({source:'ranking-page-direct',status:rr.status,foundRank:found?.rank||null,foundScore:found?.score||null});
        if(found&&validScore(found.score))return json({ok:true,id:Number(id),event,name,rank:found.rank||knownRank,score:found.score,source:'World Athletics ranking page',eventGroup:rhit?.eventGroup||null,diagnostics});
      }catch(e){diagnostics.push({source:'ranking-page-direct',error:String(e?.message||e)});}

      // Kun én reserve via Jina.
      try{
        const readerUrl=`https://r.jina.ai/${rankingUrl}`;
        const rr=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.20.7','Accept':'text/plain'}});
        const text=rr.ok?await rr.text():'';
        const found=findAthleteRow(text,name,knownRank);
        diagnostics.push({source:'ranking-table-jina',status:rr.status,foundRank:found?.rank||null,foundScore:found?.score||null});
        if(found&&validScore(found.score))return json({ok:true,id:Number(id),event,name,rank:found.rank||knownRank,score:found.score,source:'World Athletics ranking table',eventGroup:rhit?.eventGroup||null,diagnostics});
      }catch(e){diagnostics.push({source:'ranking-table-jina',error:String(e?.message||e)});}
    }
  }

  return json({ok:true,id:Number(id),event,name,rank:validRank(knownRank)?knownRank:null,score:null,source:'World Athletics',diagnostics});
}

function rankingSlug(code){return ({'100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m','100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',HJ:'high-jump',PV:'pole-vault',LJ:'long-jump',TJ:'triple-jump',SP:'shot-put',DT:'discus-throw',HT:'hammer-throw',JT:'javelin-throw',Decathlon:'decathlon',Heptathlon:'heptathlon'})[code]||'';}
function rankingEventMatches(eventGroup,code){const n=norm(eventGroup);const aliases={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon','combinedevents','combinedevent'],Heptathlon:['heptathlon','combinedevents','combinedevent']};return (aliases[code]||[]).some(a=>n===a||n.startsWith(a)||n.includes(a));}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a').replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function findAthleteRow(text,name,knownRank){if(!text||!name)return null;const wanted=normalizeName(name);for(const line of String(text).split(/\r?\n/)){if(!line.includes('|')||!normalizeName(line).includes(wanted))continue;const cols=line.split('|').map(s=>s.trim()).filter(Boolean);if(cols.length<5)continue;const rank=Number(String(cols[0]).replace(/\D/g,''));const score=Number(String(cols[4]).replace(/[^0-9]/g,''));if(validRank(rank)&&validScore(score)&&Math.abs(rank-knownRank)<=5)return {rank,score};}return null;}
function findAthleteInHtml(html,name,knownRank){if(!html||!name)return null;const plain=String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ');const wanted=normalizeName(name);const nplain=normalizeName(plain);const idx=nplain.indexOf(wanted);if(idx<0)return null;const raw=plain.slice(Math.max(0,idx-250),idx+350);const nums=[...raw.matchAll(/\b(\d{1,4})\b/g)].map(m=>Number(m[1]));const rank=nums.find(v=>validRank(v)&&Math.abs(v-knownRank)<=5);const scores=nums.filter(v=>validScore(v));return rank&&scores.length?{rank,score:scores[scores.length-1]}:null;}
function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=500&&n<=1800;}
function validRank(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<10000;}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
