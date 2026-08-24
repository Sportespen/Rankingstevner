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
        'User-Agent':'Mozilla/5.0 Rankingstevner/0.7.1',
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

    return json({
      ok:true,
      id:codeMatch?.[1] || id,
      name:name || null,
      url:profileUrl,
      sex,
      rankings:rankings.map(({rank,event})=>({rank,event})),
      personalBests
    });
  } catch (e) {
    return json({ok:false,error:'Kunne ikke hente World Athletics-profilen'},502);
  }
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
