export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const event=(url.searchParams.get('event')||'').trim();
  const combined=event==='Decathlon'||event==='Heptathlon';
  const startDate=(url.searchParams.get('startDate')||new Date().toISOString().slice(0,10));
  const endDate=(url.searchParams.get('endDate')||'2027-12-31');
  const results=[];
  const seen=new Set();

  // 1) Existing proxy feed – useful when it contains the competition.
  try{
    const res=await fetch('https://worldathletics.nimarion.de/competitions',{headers:{'Accept':'application/json','User-Agent':'Rankingstevner/0.21.0'}});
    if(res.ok){
      const data=await res.json();
      for(const x of Array.isArray(data)?data:[]){add(results,seen,normaliseProxy(x));}
    }
  }catch(_){}

  // 2) Official World Athletics Global Calendar. This is the primary future-calendar fallback.
  // Combined Events = disciplineId 1. For track/field we use the full calendar and let the client
  // match the published event information when available.
  const disciplineId=combined?'1':'';
  for(const offset of [0,100,200,300]){
    const wa=new URL('https://worldathletics.org/competition/calendar-results');
    wa.searchParams.set('startDate',startDate);
    wa.searchParams.set('endDate',endDate);
    if(disciplineId)wa.searchParams.set('disciplineId',disciplineId);
    if(offset)wa.searchParams.set('offset',String(offset));
    try{
      const r=await fetch(wa.toString(),{headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 Rankingstevner/0.21.0'}});
      if(!r.ok)continue;
      const html=await r.text();
      for(const x of extractCalendarObjects(html)) add(results,seen,x);
    }catch(_){}
  }

  // Verified official-calendar fallback rows. These prevent a false zero if WA changes its page
  // serialisation before the parser is updated. They are only future Combined Events already
  // published in the official WA calendar and are removed automatically after their end date.
  if(combined){
    const verified=[
      {name:'Décastar',location:'Stade Pierre Paul Bernard, Talence (FRA)',rankingCategory:'GL',disciplines:['Combined Events'],start:'2026-09-18',end:'2026-09-19',competitionGroup:'World Athletics Combined Events Tour'},
      {name:'International Combined Events Meeting Tallinn',location:'Tallinn (EST)',rankingCategory:'',disciplines:['Combined Events'],start:'2027-02-06',end:'2027-02-07',competitionGroup:'Combined Events'},
      {name:'European Athletics Indoor Championships',location:'Velódromo Luis Puig, Valencia (ESP)',rankingCategory:'A',disciplines:['Combined Events','Track and Field'],start:'2027-03-04',end:'2027-03-07',competitionGroup:'Area Indoor Championships'}
    ];
    const today=new Date(startDate+'T00:00:00Z');
    for(const x of verified){if(new Date(x.end+'T23:59:59Z')>=today)add(results,seen,x);}
  }

  return json({ok:true,results,source:'WA Global Calendar + fallback'});
}

function normaliseProxy(x){return {id:x.id,name:x.name,location:x.location||'',rankingCategory:x.rankingCategory||'',disciplines:Array.isArray(x.disciplines)?x.disciplines:[],start:x.start||null,end:x.end||null,competitionGroup:x.competitionGroup||'',competitionSubgroup:x.competitionSubgroup||'',hasResults:!!x.hasResults,hasStartlist:!!x.hasStartlist,hasCompetitionInformation:!!x.hasCompetitionInformation};}
function add(arr,seen,x){if(!x||!x.name||!x.start)return;const k=`${x.id||''}|${x.name}|${x.start}`.toLowerCase();if(seen.has(k))return;seen.add(k);arr.push(x);}
function decode(v){return String(v||'').replace(/\\u0026/g,'&').replace(/\\u003c/g,'<').replace(/\\u003e/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');}
function walk(v,out){if(!v)return;if(Array.isArray(v)){for(const x of v)walk(x,out);return;}if(typeof v!=='object')return;const name=v.name||v.competitionName;const start=v.startDate||v.start;const end=v.endDate||v.end;const disciplines=v.disciplines; if(name&&start&&(disciplines||v.rankingCategory||v.venue)){out.push({id:v.id||v.competitionId||null,name,location:v.venue||v.location||'',rankingCategory:v.rankingCategory||'',disciplines:Array.isArray(disciplines)?disciplines:(typeof disciplines==='string'?disciplines.split(',').map(s=>s.trim()):[]),start,end:end||start,competitionGroup:v.competitionGroup||'',competitionSubgroup:v.competitionSubgroup||'',hasResults:!!v.hasResults,hasStartlist:!!v.hasStartlist,hasCompetitionInformation:!!v.hasCompetitionInformation});}for(const x of Object.values(v))walk(x,out);}
function extractCalendarObjects(html){const out=[];const m=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);if(m){try{const data=JSON.parse(decode(m[1]));walk(data,out);}catch(_){}}if(out.length)return out;
  // Generic fallback for serialized calendar objects in Next/React payloads.
  const text=decode(html).replace(/\\"/g,'"');
  const re=/\{[^{}]{0,2500}"(?:id|competitionId)"\s*:\s*(\d+)[^{}]{0,2500}"name"\s*:\s*"([^"]+)"[^{}]{0,2500}"(?:venue|location)"\s*:\s*"([^"]*)"[^{}]{0,2500}"rankingCategory"\s*:\s*"([^"]*)"[^{}]{0,2500}"disciplines"\s*:\s*"([^"]*)"[^{}]{0,2500}"startDate"\s*:\s*"([^"]+)"[^{}]{0,1200}"endDate"\s*:\s*"([^"]+)"[^{}]*\}/g;
  let z;while((z=re.exec(text))){out.push({id:Number(z[1]),name:z[2],location:z[3],rankingCategory:z[4],disciplines:z[5]?z[5].split(',').map(s=>s.trim()):[],start:z[6],end:z[7],competitionGroup:''});}
  return out;
}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900'}})}