export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('id') || '').trim();
  const idMatch = raw.match(/(\d{7,9})/);
  if (!idMatch) return json({ok:false,error:'Ugyldig World Athletics-ID'},400);
  const id = idMatch[1];
  const profileUrl = `https://worldathletics.org/athletes/-/${id}`;
  try {
    const res = await fetch(profileUrl, {
      headers: {'User-Agent':'Mozilla/5.0 Rankingstevner/0.5','Accept':'text/html,application/xhtml+xml'}
    });
    if (!res.ok) return json({ok:false,error:`World Athletics svarte ${res.status}`},502);
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = decode(titleMatch ? titleMatch[1] : '');
    const name = title.replace(/\s*\|\s*Profile\s*\|\s*World Athletics.*$/i,'').trim();
    const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
    const rankingMatches = [...text.matchAll(/#(\d+)\s+(Men(?:'|’)s|Women(?:'|’)s)\s+([A-Za-z0-9 ,.-]{2,35})/g)]
      .slice(0,8).map(m=>({rank:Number(m[1]),event:m[3].trim()}));
    const codeMatch = text.match(/code\s+(\d{7,9})/i);
    return json({ok:true,id:codeMatch?.[1]||id,name:name||null,url:profileUrl,rankings:rankingMatches});
  } catch (e) {
    return json({ok:false,error:'Kunne ikke hente World Athletics-profilen'},502);
  }
}
function decode(s){return String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&Oslash;/g,'Ø').replace(/&oslash;/g,'ø').replace(/&AElig;/g,'Æ').replace(/&aelig;/g,'æ').replace(/&Aring;/g,'Å').replace(/&aring;/g,'å');}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
