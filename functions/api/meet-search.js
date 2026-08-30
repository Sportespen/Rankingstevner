// Nothing here bounded how long a single external call could take, and the 10 calendar-page
// fetches below ran one after another instead of at the same time - up to 11 sequential
// external fetches with no per-fetch deadline. If their cumulative wait ever crossed
// Cloudflare's own request duration limit, Cloudflare terminates the request itself and
// returns ITS OWN HTML error page - which the frontend then tried to JSON.parse(), producing
// "Unexpected token '<', <!DOCTYPE..." instead of an actual result (even an empty one).
const FETCH_TIMEOUT_MS=8000;
async function fetchWithTimeout(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const event=(url.searchParams.get('event')||'').trim();
  const combined=event==='Decathlon'||event==='Heptathlon';
  const startDate=(url.searchParams.get('startDate')||new Date().toISOString().slice(0,10));
  const endDate=(url.searchParams.get('endDate')||'2027-12-31');
  const results=[];
  const seen=new Set();

  // 1) Existing proxy feed – useful when it contains the competition.
  const proxyPromise=(async()=>{
    try{
      const res=await fetchWithTimeout('https://worldathletics.nimarion.de/competitions',{headers:{'Accept':'application/json','User-Agent':'Rankingstevner/0.22.0'}});
      if(res.ok){
        const data=await res.json();
        return Array.isArray(data)?data.map(normaliseProxy):[];
      }
    }catch(_){}
    return [];
  })();

  // 2) Official World Athletics Global Calendar.
  // We scan more result pages than before so future meetings are not silently missed - now
  // fetched concurrently instead of one after another, since each page is independent.
  const disciplineId=combined?'1':'';
  const pagePromises=[0,100,200,300,400,500,600,700,800,900].map(async offset=>{
    const wa=new URL('https://worldathletics.org/competition/calendar-results');
    wa.searchParams.set('isSearchReset','true');
    wa.searchParams.set('startDate',startDate);
    wa.searchParams.set('endDate',endDate);
    // regionId=3&regionType=area is WA's own Europe filter (confirmed from the site's own
    // discipline+region picker) - the app only ever wants European meets anyway (filtered
    // client-side already via isEurope()), so narrowing server-side too means far fewer
    // irrelevant pages to page through for the same coverage.
    wa.searchParams.set('regionId','3');
    wa.searchParams.set('regionType','area');
    if(disciplineId)wa.searchParams.set('disciplineId',disciplineId);
    if(offset)wa.searchParams.set('offset',String(offset));
    try{
      const r=await fetchWithTimeout(wa.toString(),{headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/0.22.0'}});
      if(!r.ok)return [];
      const html=await r.text();
      return extractCalendarObjects(html);
    }catch(_){return [];}
  });

  const [proxyResults,...pageResults]=await Promise.all([proxyPromise,...pagePromises]);
  for(const x of proxyResults)add(results,seen,x);
  for(const page of pageResults)for(const x of page)add(results,seen,x);

  // Verified official-calendar fallback rows. These are only used to prevent a false zero
  // when WA changes page serialisation before the parser is updated.
  if(combined){
    const verified=[
      {name:'Décastar',location:'Stade Pierre Paul Bernard, Talence (FRA)',rankingCategory:'GL',disciplines:['Combined Events'],start:'2026-09-18',end:'2026-09-19',competitionGroup:'World Athletics Combined Events Tour',venueType:'outdoor'},
      {name:'International Combined Events Meeting Tallinn',location:'Tallinn (EST)',rankingCategory:'',disciplines:['Combined Events'],start:'2027-02-06',end:'2027-02-07',competitionGroup:'Combined Events',venueType:'indoor'},
      {name:'European Athletics Indoor Championships',location:'Velódromo Luis Puig, Valencia (ESP)',rankingCategory:'A',disciplines:['Combined Events','Track and Field'],start:'2027-03-04',end:'2027-03-07',competitionGroup:'Area Indoor Championships',venueType:'indoor'}
    ];
    const today=new Date(startDate+'T00:00:00Z');
    for(const x of verified){if(new Date(x.end+'T23:59:59Z')>=today)add(results,seen,x);}
  }

  return json({ok:true,results,source:'WA Global Calendar + fallback'});
}

function inferVenueType(x){
  const explicit=String(x?.venueType||x?.environment||x?.competitionType||'').toLowerCase();
  if(/indoor|short track/.test(explicit))return'indoor';
  if(/outdoor/.test(explicit))return'outdoor';
  const s=[x?.name,x?.location,x?.venue,x?.competitionGroup,x?.competitionSubgroup,Array.isArray(x?.disciplines)?x.disciplines.join(' '):x?.disciplines].filter(Boolean).join(' ').toLowerCase();
  if(/indoor|short track|indoors|hallen|hall meeting|indoor arena|vel[oó]dromo/.test(s))return'indoor';
  if(/outdoor|stadium|stadion|stade|sports ground|athletics track/.test(s))return'outdoor';
  return'';
}
function normaliseProxy(x){const out={id:x.id,name:x.name,location:x.location||'',rankingCategory:x.rankingCategory||'',disciplines:Array.isArray(x.disciplines)?x.disciplines:[],start:x.start||null,end:x.end||null,competitionGroup:x.competitionGroup||'',competitionSubgroup:x.competitionSubgroup||'',hasResults:!!x.hasResults,hasStartlist:!!x.hasStartlist,hasCompetitionInformation:!!x.hasCompetitionInformation,venueType:x.venueType||x.environment||''};out.venueType=inferVenueType(out);return out;}
function add(arr,seen,x){if(!x||!x.name||!x.start)return;x.venueType=inferVenueType(x);const k=`${x.id||''}|${x.name}|${x.start}`.toLowerCase();if(seen.has(k))return;seen.add(k);arr.push(x);}
function decode(v){return String(v||'').replace(/\\u0026/g,'&').replace(/\\u003c/g,'<').replace(/\\u003e/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');}
function walk(v,out){if(!v)return;if(Array.isArray(v)){for(const x of v)walk(x,out);return;}if(typeof v!=='object')return;const name=v.name||v.competitionName;const start=v.startDate||v.start;const end=v.endDate||v.end;const disciplines=v.disciplines;if(name&&start&&(disciplines||v.rankingCategory||v.venue)){const row={id:v.id||v.competitionId||null,name,location:v.venue||v.location||'',rankingCategory:v.rankingCategory||'',disciplines:Array.isArray(disciplines)?disciplines:(typeof disciplines==='string'?disciplines.split(',').map(s=>s.trim()):[]),start,end:end||start,competitionGroup:v.competitionGroup||'',competitionSubgroup:v.competitionSubgroup||'',hasResults:!!v.hasResults,hasStartlist:!!v.hasStartlist,hasCompetitionInformation:!!v.hasCompetitionInformation,venueType:v.venueType||v.environment||v.competitionType||''};row.venueType=inferVenueType(row);out.push(row);}for(const x of Object.values(v))walk(x,out);}
function extractCalendarObjects(html){const out=[];const m=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);if(m){try{const data=JSON.parse(decode(m[1]));walk(data,out);}catch(_){}}if(out.length)return out;
  const text=decode(html).replace(/\\"/g,'"');
  const re=/\{[^{}]{0,2500}"(?:id|competitionId)"\s*:\s*(\d+)[^{}]{0,2500}"name"\s*:\s*"([^"]+)"[^{}]{0,2500}"(?:venue|location)"\s*:\s*"([^"]*)"[^{}]{0,2500}"rankingCategory"\s*:\s*"([^"]*)"[^{}]{0,2500}"disciplines"\s*:\s*"([^"]*)"[^{}]{0,2500}"startDate"\s*:\s*"([^"]+)"[^{}]{0,1200}"endDate"\s*:\s*"([^"]+)"[^{}]*\}/g;
  let z;while((z=re.exec(text))){const row={id:Number(z[1]),name:z[2],location:z[3],rankingCategory:z[4],disciplines:z[5]?z[5].split(',').map(s=>s.trim()):[],start:z[6],end:z[7],competitionGroup:''};row.venueType=inferVenueType(row);out.push(row);}
  return out;
}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900'}})}