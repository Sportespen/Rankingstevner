export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const idMatch = raw.match(/(\d{7,9})/);
  if (!idMatch) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const id = idMatch[1];
  const profileUrl = `https://worldathletics.org/athletes/-/${id}`;

  try {
    const res = await fetch(profileUrl, {
      headers: {'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.6','Accept':'text/html,application/xhtml+xml'}
    });
    if (!res.ok) return json({ok:false,error:`World Athletics svarte ${res.status}`},502);

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = decode(titleMatch ? titleMatch[1] : '');
    const name = title.replace(/\s*\|\s*Profile\s*\|\s*World Athletics.*$/i,'').trim();
    const text = htmlToText(html);

    const rankings = parseRankings(text);
    const personalBests = parsePersonalBests(text);
    const sex = inferSex(text, rankings);
    const codeMatch = text.match(/code\s+(\d{7,9})/i);
    const rankingScores = await fetchRankingScores(name, sex, rankings, personalBests);

    return json({
      ok:true,
      id:codeMatch?.[1] || id,
      name:name || null,
      url:profileUrl,
      sex,
      rankings:rankings.map(({rank,event})=>({rank,event})),
      rankingScores,
      personalBests
    });
  } catch (e) {
    return json({ok:false,error:'Kunne ikke hente World Athletics-profilen'},502);
  }
}

function inferSex(text, rankings){
  const src = rankings[0]?.label || text.match(/\b(Men(?:'|’)s|Woman(?:'|’)s|Women(?:'|’)s)\b/i)?.[1] || '';
  if (/^Men/i.test(src)) return 'M';
  if (/^(Woman|Women)/i.test(src)) return 'W';
  return null;
}

async function fetchRankingScores(name, sex, rankings, personalBests){
  if(!name) return [];

  const slugMap = {
    'Decathlon':'decathlon','Heptathlon':'heptathlon','100 Metres':'100m','200 Metres':'200m','400 Metres':'400m',
    '800 Metres':'800m','1500 Metres':'1500m','5000 Metres':'5000m','10000 Metres':'10000m',
    '110 Metres Hurdles':'110mh','100 Metres Hurdles':'100mh','400 Metres Hurdles':'400mh',
    '3000 Metres Steeplechase':'3000msc','High Jump':'high-jump','Pole Vault':'pole-vault',
    'Long Jump':'long-jump','Triple Jump':'triple-jump','Shot Put':'shot-put','Discus Throw':'discus-throw',
    'Hammer Throw':'hammer-throw','Javelin Throw':'javelin-throw'
  };

  const rankByEvent = new Map((rankings || []).map(r => [r.event, Number(r.rank)]));
  const candidates = [];
  for (const r of rankings || []) if (slugMap[r.event]) candidates.push(r.event);
  for (const p of personalBests || []) {
    let ev = p.event;
    if (ev === 'Heptathlon Short Track' && sex === 'M') ev = 'Decathlon';
    if (slugMap[ev]) candidates.push(ev);
  }

  const uniqueEvents = [...new Set(candidates)].slice(0,6);
  const sexPaths = sex === 'W' ? ['women'] : sex === 'M' ? ['men'] : ['men','women'];
  const out=[];

  for(const event of uniqueEvents){
    const slug = slugMap[event];
    const knownRank = rankByEvent.get(event);
    const pages = Number.isFinite(knownRank) ? [Math.max(1,Math.ceil(knownRank/100))] : [1,2,3,4,5,6,7];

    let found = null;
    for(const sexPath of sexPaths){
      for(const page of pages){
        const rankingUrl=`https://worldathletics.org/world-rankings/${slug}/${sexPath}?page=${page}`;
        const text = await fetchRankingText(rankingUrl, name);
        if(!text) continue;
        found = findRankingRow(text, name, event, knownRank);
        if(found){
          found.url = rankingUrl;
          break;
        }
      }
      if(found) break;
    }
    if(found) out.push(found);
  }

  return out;
}

async function fetchRankingText(rankingUrl, name){
  try{
    const direct=await fetch(rankingUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.6','Accept':'text/html,application/xhtml+xml'}});
    if(direct.ok){
      const directText=htmlToText(await direct.text());
      if(normalizeName(directText).includes(normalizeName(name))) return directText;
    }
  }catch(_){ }

  try{
    const readerUrl=`https://r.jina.ai/https://worldathletics.org${new URL(rankingUrl).pathname}${new URL(rankingUrl).search}`;
    const reader=await fetch(readerUrl,{headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.6','Accept':'text/plain'}});
    if(reader.ok) return decode(await reader.text());
  }catch(_){ }

  return '';
}

function findRankingRow(text, name, event, knownRank){
  const wanted = normalizeName(name);
  const lines = String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

  for(const line of lines){
    if(!normalizeName(line).includes(wanted)) continue;
    const nums=[...line.matchAll(/\b(9\d{2}|1[0-5]\d{2})\b/g)].map(m=>Number(m[1]));
    const score=nums.length ? nums[nums.length-1] : null;
    if(!score || score<900 || score>1600) continue;
    const rankMatch=line.match(/^\s*(\d{1,4})\s*(?:\||\s)/);
    const rank=rankMatch ? Number(rankMatch[1]) : (Number.isFinite(knownRank) ? knownRank : null);
    return {event,rank,score};
  }

  const raw=String(text);
  const nameTokens=normalizeName(name).split(' ').filter(Boolean);
  const last=nameTokens[nameTokens.length-1] || '';
  const rawNorm=normalizeName(raw);
  const idx=last ? rawNorm.indexOf(last) : -1;
  if(idx>=0){
    const window=raw.slice(Math.max(0,idx-220),idx+700);
    const nums=[...window.matchAll(/\b(9\d{2}|1[0-5]\d{2})\b/g)].map(m=>Number(m[1]));
    const score=nums.find(v=>v>=900&&v<=1600);
    if(score) return {event,rank:Number.isFinite(knownRank)?knownRank:null,score};
  }
  return null;
}

function normalizeName(s){
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a')
    .replace(/[‐‑‒–—-]/g,' ').replace(/[^a-zA-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}

function parseRankings(text){
  const eventNames=['Decathlon','Heptathlon','100 Metres','200 Metres','400 Metres','800 Metres','1500 Metres','5000 Metres','10000 Metres','110 Metres Hurdles','100 Metres Hurdles','400 Metres Hurdles','3000 Metres Steeplechase','High Jump','Pole Vault','Long Jump','Triple Jump','Shot Put','Discus Throw','Hammer Throw','Javelin Throw'];
  const out=[];
  for(const event of eventNames){
    const esc=event.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp(`#(\\d+)\\s+(Men(?:'|’)s|Woman(?:'|’)s|Women(?:'|’)s)\\s+${esc}`,'i');
    const m=text.match(re);
    if(m) out.push({rank:Number(m[1]),event,label:m[2]});
  }
  return out.slice(0,8);
}

function parsePersonalBests(text){
  const section=(text.split(/Personal bests/i)[1] || '').split(/Season(?:'|’)s bests/i)[0] || '';
  if(!section) return [];
  const eventNames=['Decathlon','Heptathlon','Heptathlon Short Track','100 Metres','200 Metres','400 Metres','800 Metres','1500 Metres','5000 Metres','10000 Metres','60 Metres','60 Metres Hurdles','110 Metres Hurdles','100 Metres Hurdles','400 Metres Hurdles','3000 Metres Steeplechase','High Jump','Pole Vault','Long Jump','Triple Jump','Shot Put','Discus Throw','Hammer Throw','Javelin Throw'];
  const found=[];
  for(const event of eventNames){
    const esc=event.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp(`${esc}\\s+Result\\s+([^\\s]+(?:\\s+\\*)?)\\s+Date\\s+(\\d{1,2}\\s+[A-Z]{3}\\s+\\d{4})\\s+Score\\s+(\\d+)`,'i');
    const m=section.match(re);
    if(m) found.push({event,result:m[1].trim(),date:m[2].trim(),score:Number(m[3])});
  }
  return found.slice(0,10);
}

function htmlToText(html){
  return decode(String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
}

function decode(s){
  return String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/&Oslash;/g,'Ø').replace(/&oslash;/g,'ø').replace(/&AElig;/g,'Æ').replace(/&aelig;/g,'æ').replace(/&Aring;/g,'Å').replace(/&aring;/g,'å');
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
