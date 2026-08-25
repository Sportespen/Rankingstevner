export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const id=(url.searchParams.get('id')||'').trim();
  if(!/^\d+$/.test(id)) return json({ok:false,error:'Ugyldig stevne-ID'},400);
  try{
    const res=await fetch(`https://worldathletics.nimarion.de/competitions/${id}/organiser`,{headers:{'Accept':'application/json','User-Agent':'Rankingstevner/0.19.0'}});
    if(!res.ok) return json({ok:false,error:`WA-kilde ${res.status}`},502);
    const data=await res.json();
    return json({ok:true,details:data});
  }catch(e){return json({ok:false,error:String(e?.message||e)},502)}
}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600'}})}
