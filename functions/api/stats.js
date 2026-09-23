function lastNDayKeys(n){
  const out=[],now=new Date();
  for(let i=0;i<n;i++){
    const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-i));
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}

export async function onRequestGet({env}){
  const kv=env.VISITS_KV;
  if(!kv)return new Response(JSON.stringify({error:'VISITS_KV er ikke bundet til dette Pages-prosjektet ennå.'}),{status:500,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  const days=lastNDayKeys(30);
  const rows=await Promise.all(days.map(async date=>{
    const [total,unique]=await Promise.all([kv.get(`total:${date}`),kv.get(`unique:${date}`)]);
    return {date,total:Number(total)||0,unique:Number(unique)||0};
  }));
  rows.reverse();
  return new Response(JSON.stringify({days:rows,generatedAt:new Date().toISOString()}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
