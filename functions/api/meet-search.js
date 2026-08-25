export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const q=(url.searchParams.get('q')||'').trim();
  const upstream=new URL('https://worldathletics.nimarion.de/competitions');
  if(q) upstream.searchParams.set('name',q);
  try{
    const res=await fetch(upstream.toString(),{headers:{'Accept':'application/json','User-Agent':'Rankingstevner/0.19.0'}});
    if(!res.ok) return json({ok:false,results:[],error:`WA-kilde ${res.status}`},502);
    const data=await res.json();
    const list=Array.isArray(data)?data:[];
    return json({ok:true,results:list.map(x=>({
      id:x.id,name:x.name,location:x.location||'',rankingCategory:x.rankingCategory||'',disciplines:Array.isArray(x.disciplines)?x.disciplines:[],start:x.start||null,end:x.end||null,competitionGroup:x.competitionGroup||'',competitionSubgroup:x.competitionSubgroup||'',hasResults:!!x.hasResults,hasStartlist:!!x.hasStartlist,hasCompetitionInformation:!!x.hasCompetitionInformation
    }))});
  }catch(e){return json({ok:false,results:[],error:String(e?.message||e)},502)}
}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900'}})}
