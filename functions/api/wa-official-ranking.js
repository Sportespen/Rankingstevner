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
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.7','Accept':'application/json'}
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

    // World Athletics' ferskeste standardvisning bruker /null. /women og /men kan ligge
    // en rankingpublisering bak. Derfor prøver vi /null først, deretter kjønnsstien som fallback.
    const variants=[
      `https://worldathletics.org/world-rankings/${slug}/null?page=${page}`,
      `https://worldathletics.org/world-rankings/${slug}/${sexPath}?page=${page}`
    ];

    let score=null;
    let usedUrl=null;
    const diagnostics=[];

    for(const rankingUrl of variants){
      let text='';
      let readerStatus=null;
      let directStatus=null;
      const u=new URL(rankingUrl);
      const readerUrl=`https://r.jina.ai/https://worldathletics.org${u.pathname}${u.search}`;
      try{
        const rr=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.7','Accept':'text/plain'}});
        readerStatus=rr.status;
        if(rr.ok) text=await rr.text();
      }catch(_){ }
      if(!text){
        try{
          const direct=await fetch(rankingUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.19.7','Accept':'text/html,application/xhtml+xml'}});
          directStatus=direct.status;
          if(direct.ok) text=htmlToLines(await direct.text());
        }catch(_){ }
      }
      const parsed=findScore(text,name,rank);
      diagnostics.push({rankingUrl,readerStatus,directStatus,textLength:text.length,parsed});
      if(Number.isFinite(parsed)&&parsed>0){score=parsed;usedUrl=rankingUrl;break;}
    }

    return json({ok:true,id:Number(id),event,name,rank,score,source:'World Athletics',rankingUrl:usedUrl,diagnostics});
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
function findScore(text,name,knownRank){
  if(!text||!name)return null;
  const wanted=normalizeName(name);
  const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

  // Markdown-tabellen fra WA/Jina: Place | Competitor | DOB | Country | Score | Event List.
  // Les kolonnene eksplisitt i stedet for å gjette blant alle tall rundt navnet.
  for(const line of lines){
    if(!line.includes('|')||!normalizeName(line).includes(wanted)) continue;
    const cols=line.split('|').map(s=>s.trim()).filter((s,i,a)=>!(i===0&&s==='')&&!(i===a.length-1&&s===''));
    if(cols.length<5) continue;
    const rowRank=Number(String(cols[0]).replace(/\D/g,''));
    if(Number.isFinite(knownRank)&&knownRank>0&&rowRank!==knownRank) continue;
    if(!normalizeName(cols[1]).includes(wanted)) continue;
    const score=Number(String(cols[4]).replace(/[^0-9]/g,''));
    if(Number.isFinite(score)&&score>=500&&score<=1800) return score;
  }

  // Fallback: finn linjen med korrekt rank + navn og ta siste plausible score på samme linje.
  for(const line of lines){
    if(!normalizeName(line).includes(wanted)) continue;
    const rankMatch=line.match(/^\s*(\d{1,4})\b/);
    if(rankMatch&&Number(rankMatch[1])!==knownRank) continue;
    const nums=[...line.matchAll(/\b(\d{3,4})\b/g)].map(m=>Number(m[1]));
    const scores=nums.filter(v=>v>=500&&v<=1800);
    if(scores.length) return scores[scores.length-1];
  }
  return null;
}
function htmlToLines(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<\/(tr|td|th|div|li|p|section|article)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\r/g,'').replace(/[ \t]+/g,' ');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
