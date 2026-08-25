export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const raw=(url.searchParams.get('id')||'').trim();
  const id=raw.match(/(\d{7,9})/)?.[1];
  const event=(url.searchParams.get('event')||'').trim();
  const sex=(url.searchParams.get('sex')||'').trim().toUpperCase();
  if(!id) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);
  if(!event) return json({ok:false,error:'Mangler øvelse'},400);

  const slugMap={
    '100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m',
    '100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',HJ:'high-jump',PV:'pole-vault',LJ:'long-jump',TJ:'triple-jump',
    SP:'shot-put',DT:'discus-throw',HT:'hammer-throw',JT:'javelin-throw',Decathlon:'decathlon',Heptathlon:'heptathlon'
  };
  const slug=slugMap[event];
  if(!slug) return json({ok:false,error:'Øvelsen støttes ikke'},400);

  try{
    const athleteRes=await fetch(`https://worldathletics.nimarion.de/athletes/${id}`,{
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.6','Accept':'application/json'}
    });
    const athlete=athleteRes.ok?await athleteRes.json():null;
    if(!athlete) return json({ok:false,error:'Kunne ikke hente WA-profil'},502);

    const name=`${athlete.firstname||''} ${athlete.lastname||''}`.trim();
    const rankings=Array.isArray(athlete.currentWorldRankings)?athlete.currentWorldRankings:[];
    const hit=rankings.find(r=>rankingEventMatches(r?.eventGroup,event));
    const rank=Number(hit?.place);
    if(!Number.isFinite(rank)||rank<1) return json({ok:true,id:Number(id),event,name,rank:null,score:null,source:'World Athletics'});

    const page=Math.max(1,Math.ceil(rank/100));
    const sexPath=sex==='W'?'women':'men';
    const rankingUrl=`https://worldathletics.org/world-rankings/${slug}/${sexPath}?page=${page}`;
    const readerUrl=`https://r.jina.ai/https://worldathletics.org/world-rankings/${slug}/${sexPath}?page=${page}`;

    let text='';
    let readerStatus=null;
    let directStatus=null;
    try{
      const rr=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.6','Accept':'text/plain'}});
      readerStatus=rr.status;
      if(rr.ok) text=await rr.text();
    }catch(_){ }

    if(!text){
      try{
        const direct=await fetch(rankingUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.6','Accept':'text/html,application/xhtml+xml'}});
        directStatus=direct.status;
        if(direct.ok) text=htmlToLines(await direct.text());
      }catch(_){ }
    }

    const score=findScore(text,name,rank);
    return json({ok:true,id:Number(id),event,name,rank,score,source:'World Athletics',rankingUrl,diagnostics:{readerStatus,directStatus,page,textLength:text.length}});
  }catch(e){
    return json({ok:false,error:'Kunne ikke hente offisiell WA Ranking Score',detail:String(e?.message||e)},502);
  }
}

function rankingEventMatches(eventGroup,code){
  const n=norm(eventGroup);
  const aliases={
    '100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],
    '100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc','3000msteeplechase'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon'],Heptathlon:['heptathlon']
  };
  return (aliases[code]||[]).some(a=>n===a||n.startsWith(a));
}
function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/short track/g,'sh').replace(/[^a-z0-9]+/g,'');}
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a').replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function scoreCandidates(fragment,knownRank){
  return [...String(fragment||'').matchAll(/\b(\d{3,4})\b/g)]
    .map(m=>Number(m[1]))
    .filter(v=>v>=500&&v<=1800&&v!==knownRank&&!(v>=1900&&v<=2100));
}
function findScore(text,name,knownRank){
  if(!text||!name)return null;
  const wanted=normalizeName(name);
  const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

  // Normal WA/Jina tabell: hele utøverraden på én linje.
  for(const line of lines){
    if(!normalizeName(line).includes(wanted)) continue;
    const scores=scoreCandidates(line,knownRank);
    if(scores.length) return scores[scores.length-1];
  }

  // Jina kan dele en tabellrad over flere linjer. Finn navnelinjen og les et lite
  // vindu rundt den. Fødselsår filtreres eksplisitt bort; rank < 500 faller bort.
  for(let i=0;i<lines.length;i++){
    if(!normalizeName(lines[i]).includes(wanted)) continue;
    const block=lines.slice(Math.max(0,i-3),Math.min(lines.length,i+7)).join(' | ');
    const scores=scoreCandidates(block,knownRank);
    if(scores.length) return scores[0];
  }

  // Siste fallback mot rå tekst når Markdown/formatering gjør linjedelingen ubrukelig.
  const parts=wanted.split(' ').filter(Boolean);
  if(parts.length){
    const raw=String(text);
    const lower=normalizeName(raw);
    const idx=lower.indexOf(wanted);
    if(idx>=0){
      // Normalisering endrer lengder noe, så bruk et romslig utdrag av råteksten.
      const rough=Math.max(0,Math.min(raw.length,idx));
      const window=raw.slice(Math.max(0,rough-400),Math.min(raw.length,rough+1200));
      const scores=scoreCandidates(window,knownRank);
      if(scores.length) return scores[0];
    }
  }
  return null;
}
function htmlToLines(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<\/(tr|td|th|div|li|p|section|article)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\r/g,'').replace(/[ \t]+/g,' ');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
