export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const idMatch = raw.match(/(\d{7,9})/);
  if (!idMatch) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);

  const id = idMatch[1];
  const profileUrl = `https://worldathletics.org/athletes/-/${id}`;

  try {
    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.5',
        'Accept':'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) return json({ok:false,error:`World Athletics svarte ${res.status}`},502);

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = decode(titleMatch ? titleMatch[1] : '');
    const name = title.replace(/\s*\|\s*Profile\s*\|\s*World Athletics.*$/i,'').trim();

    const text = decode(
      html
        .replace(/<script[\s\S]*?<\/script>/gi,' ')
        .replace(/<style[\s\S]*?<\/style>/gi,' ')
        .replace(/<[^>]+>/g,' ')
        .replace(/\s+/g,' ')
    );

    const rankings = parseRankings(text);
    let sex = null;
    const sexSource = rankings[0]?.label || text.match(/#\d+\s+(Men(?:'|’)s|Woman(?:'|’)s|Women(?:'|’)s)\s+/)?.[1] || '';
    if (/^Men/i.test(sexSource)) sex = 'M';
    if (/^(Woman|Women)/i.test(sexSource)) sex = 'W';

    const personalBests = parsePersonalBests(text);
    const codeMatch = text.match(/code\s+(\d{7,9})/i);
    const rankingScores = await fetchRankingScores(name, sex, rankings);

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

async function fetchRankingScores(name, sex, rankings){
  if(!name || !sex || !Array.isArray(rankings)) return [];
  const sexPath = sex === 'W' ? 'women' : 'men';
  const slugMap = {
    'Decathlon':'decathlon',
    'Heptathlon':'heptathlon',
    '100 Metres':'100m',
    '200 Metres':'200m',
    '400 Metres':'400m',
    '800 Metres':'800m',
    '1500 Metres':'1500m',
    '5000 Metres':'5000m',
    '10000 Metres':'10000m',
    '110 Metres Hurdles':'110mh',
    '100 Metres Hurdles':'100mh',
    '400 Metres Hurdles':'400mh',
    '3000 Metres Steeplechase':'3000msc',
    'High Jump':'high-jump',
    'Pole Vault':'pole-vault',
    'Long Jump':'long-jump',
    'Triple Jump':'triple-jump',
    'Shot Put':'shot-put',
    'Discus Throw':'discus-throw',
    'Hammer Throw':'hammer-throw',
    'Javelin Throw':'javelin-throw'
  };

  const out=[];
  const wantedName = normalizeName(name);

  for(const r of rankings.slice(0,4)){
    const slug=slugMap[r.event];
    if(!slug) continue;

    const page = Math.max(1, Math.ceil((Number(r.rank)||1)/100));
    const rankingUrl=`https://worldathletics.org/world-rankings/${slug}/${sexPath}?page=${page}`;

    try{
      const res=await fetch(rankingUrl,{
        headers:{
          'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.5',
          'Accept':'text/html,application/xhtml+xml'
        }
      });
      if(!res.ok) continue;

      const html=await res.text();
      const text=decode(
        html
          .replace(/<script[\s\S]*?<\/script>/gi,' ')
          .replace(/<style[\s\S]*?<\/style>/gi,' ')
          .replace(/<[^>]+>/g,' ')
          .replace(/\s+/g,' ')
      );

      const rank = Number(r.rank);
      if(!Number.isFinite(rank)) continue;

      // Finn raden ved å bruke den kjente plasseringen fra utøverprofilen som anker.
      const rankRe = new RegExp(`(?:^|\\s)${rank}\\s+`,'g');
      let match;
      let found = null;

      while((match = rankRe.exec(text))){
        const row = text.slice(match.index, match.index + 420);
        if(!normalizeName(row).includes(wantedName)) continue;

        // WA-tabellen har rekkefølgen: plass, navn, fødselsdato, land, Score, Event List.
        const eventLabel = r.event === 'Decathlon' ? 'Decathlon' : r.event === 'Heptathlon' ? 'Heptathlon' : r.event;
        const eventPos = row.toLowerCase().lastIndexOf(eventLabel.toLowerCase());
        const scoreArea = eventPos > 0 ? row.slice(0,eventPos) : row;
        const nums = [...scoreArea.matchAll(/\b(9\d{2}|1[0-5]\d{2})\b/g)].map(m=>Number(m[1]));
        const score = nums.length ? nums[nums.length-1] : null;

        if(score && score >= 900 && score <= 1600){
          found = {event:r.event,rank:r.rank,score,url:rankingUrl};
          break;
        }
      }

      if(found) out.push(found);
    }catch(_){ }
  }

  return out;
}

function normalizeName(s){
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/Ø/g,'O').replace(/ø/g,'o')
    .replace(/Æ/g,'AE').replace(/æ/g,'ae')
    .replace(/Å/g,'A').replace(/å/g,'a')
    .replace(/[‐‑‒–—-]/g,' ')
    .replace(/[^a-zA-Z0-9 ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

function parseRankings(text){
  const eventNames = [
    'Decathlon','Heptathlon','100 Metres','200 Metres','400 Metres','800 Metres','1500 Metres','5000 Metres','10000 Metres',
    '110 Metres Hurdles','100 Metres Hurdles','400 Metres Hurdles','3000 Metres Steeplechase',
    'High Jump','Pole Vault','Long Jump','Triple Jump','Shot Put','Discus Throw','Hammer Throw','Javelin Throw'
  ];
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
  const eventNames = [
    'Decathlon','Heptathlon','Heptathlon Short Track','100 Metres','200 Metres','400 Metres','800 Metres','1500 Metres','5000 Metres','10000 Metres',
    '60 Metres','60 Metres Hurdles','110 Metres Hurdles','100 Metres Hurdles','400 Metres Hurdles','3000 Metres Steeplechase',
    'High Jump','Pole Vault','Long Jump','Triple Jump','Shot Put','Discus Throw','Hammer Throw','Javelin Throw'
  ];
  const found=[];
  for(const event of eventNames){
    const esc=event.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp(`${esc}\\s+Result\\s+([^\\s]+(?:\\s+\\*)?)\\s+Date\\s+(\\d{1,2}\\s+[A-Z]{3}\\s+\\d{4})\\s+Score\\s+(\\d+)`,'i');
    const m=section.match(re);
    if(m) found.push({event,result:m[1].trim(),date:m[2].trim(),score:Number(m[3])});
  }
  return found.slice(0,10);
}

function decode(s){
  return String(s)
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&nbsp;/g,' ')
    .replace(/&Oslash;/g,'Ø')
    .replace(/&oslash;/g,'ø')
    .replace(/&AElig;/g,'Æ')
    .replace(/&aelig;/g,'æ')
    .replace(/&Aring;/g,'Å')
    .replace(/&aring;/g,'å');
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store'
    }
  });
}
