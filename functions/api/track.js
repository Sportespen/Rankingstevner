const BOT_RE=/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|pingdom|uptimerobot|headlesschrome|lighthouse|preview/i;
const YEAR=60*60*24*400;
const DAY_PLUS=60*60*26;

function todayKey(){return new Date().toISOString().slice(0,10);}
async function sha256Hex(input){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function bump(kv,key,ttl){
  const raw=await kv.get(key);
  await kv.put(key,String((Number(raw)||0)+1),{expirationTtl:ttl});
}

export async function onRequestPost({request,env}){
  const noStore={status:204,headers:{'cache-control':'no-store'}};
  try{
    const kv=env.VISITS_KV;
    if(!kv)return new Response(null,noStore);
    const ua=request.headers.get('user-agent')||'';
    if(BOT_RE.test(ua))return new Response(null,noStore);
    const date=todayKey();
    const event=(new URL(request.url).searchParams.get('e')||'').slice(0,64).replace(/[^a-zA-Z0-9:_-]/g,'');
    if(event){
      await bump(kv,`event:${date}:${event}`,YEAR);
      return new Response(null,noStore);
    }
    const ip=request.headers.get('cf-connecting-ip')||'';
    await bump(kv,`total:${date}`,YEAR);
    const seenKey=`seen:${date}:${await sha256Hex(ip+'|'+date)}`;
    if(!(await kv.get(seenKey))){
      await kv.put(seenKey,'1',{expirationTtl:DAY_PLUS});
      await bump(kv,`unique:${date}`,YEAR);
    }
    return new Response(null,noStore);
  }catch(_err){
    return new Response(null,noStore);
  }
}
