function lastNDayKeys(n){
  const out=[],now=new Date();
  for(let i=0;i<n;i++){
    const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-i));
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}

async function eventTotals(kv,days){
  const totals={};
  for(const date of days){
    const prefix=`event:${date}:`;
    const list=await kv.list({prefix});
    for(const key of list.keys){
      const name=key.name.slice(prefix.length);
      const val=await kv.get(key.name);
      totals[name]=(totals[name]||0)+(Number(val)||0);
    }
  }
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
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
  const events=await eventTotals(kv,days);
  return new Response(JSON.stringify({days:rows,events,generatedAt:new Date().toISOString()}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
