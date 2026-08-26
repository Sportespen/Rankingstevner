// Audited against World Athletics World Ranking Rules 2026.
// Final source of truth for placing scores used by the calculator UI and calculation engine.
(() => {
  'use strict';

  const TABLES = {
    standard:{
      OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],
      DF:[170,150,130,120,110,100,95,90,63,56,49,42],
      GW:[140,120,110,100,90,80,75,70,49,42,35,32],
      GL:[120,105,95,85,75,70,65,60,42,35,31,28],
      A:[100,84,77,70,63,56,49,42,35,31,27,24],
      B:[70,56,49,42,38,34,30,27,24,21,18,15],
      C:[42,35,31,28,25,22,19,16,14,12,10,8],
      D:[28,24,21,18,15,13,12,11],
      E:[18,15,13,11,9,7],
      F:[11,7,4]
    },
    distance:{
      OW:[215,190,170,155,140,130,120,110,77,70,63,56,52,49,46,43],
      DF:[130,115,100,87,80,73,66,59,49,42,38,35],
      GW:[115,95,85,77,70,63,56,49,39,32,28,25],
      GL:[95,85,77,70,63,56,49,42,32,28,24,21],
      A:[70,63,56,49,42,35,31,27,24,21,18,15],
      B:[50,42,35,31,27,24,21,18,15,13,11,9],
      C:[35,28,24,21,18,16,14,13,11,9,8,7],
      D:[25,19,15,13,11,9,8,7],
      E:[14,11,9,8,7,6],
      F:[8,5,3]
    },
    tenk:{
      OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],
      DF:[125,105,95,85,75,67,60,53,35,28,24,21],
      GW:[100,85,75,65,56,49,42,35,28,22,19,17],
      GL:[80,65,55,46,39,35,31,28,21,18,15,14],
      A:[56,49,42,35,31,27,24,21,18,15,13,11],
      B:[42,35,31,27,24,21,18,15,13,11,9,8],
      C:[32,27,22,18,15,13,12,11,10,9,8,7],
      D:[21,15,13,11,10,9,8,7],
      E:[14,10,7,6,5,4],
      F:[7,4,2]
    },
    combined:{
      OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],
      DF:[125,105,95,85,75,67,60,53,35,28,24,21],
      GW:[100,85,75,65,56,49,42,35,25,21,17,13],
      GL:[80,65,55,46,39,35,31,28,21,17,14,11],
      A:[56,49,42,35,31,27,24,21,15,13,11,9],
      B:[42,35,31,27,24,21,18,15,13,11,9,8],
      C:[32,27,22,18,15,13,12,11,10,9,8,7],
      D:[21,15,13,11,10,9,8,7],
      E:[14,10,7,6,5,4],
      F:[7,4,2]
    }
  };

  function groupFor(code){
    if(code==='5000m'||code==='3000mSC') return 'distance';
    if(code==='10000m') return 'tenk';
    if(code==='Decathlon'||code==='Heptathlon') return 'combined';
    return 'standard';
  }

  function patchEngine(){
    try{
      if(typeof placingTables!=='undefined'){
        Object.keys(TABLES).forEach(group=>{
          if(!placingTables[group]) placingTables[group]={};
          Object.keys(TABLES[group]).forEach(cat=>placingTables[group][cat]=TABLES[group][cat].slice());
        });
      }
    }catch(_){ }
  }

  function rebuildAndSync(preserve=true){
    patchEngine();
    const event=document.getElementById('event');
    const category=document.getElementById('category');
    const placing=document.getElementById('placing');
    if(!event||!category||!placing) return;
    const group=groupFor(event.value);
    const arr=TABLES[group]?.[category.value]||[];
    const old=preserve?placing.value:'';
    if(arr.length){
      placing.innerHTML=arr.map((_,i)=>`<option value="${i+1}">${i+1}. plass</option>`).join('');
      placing.value=old && Number(old)<=arr.length ? old : '1';
    }
    const ps=arr[Number(placing.value)-1] ?? null;
    const psPreview=document.getElementById('placingScorePreview');
    if(psPreview) psPreview.textContent=ps==null?'–':String(ps);

    // resultScore is already wind-adjusted by the calculator engine.
    const rs=Number(String(document.getElementById('resultScore')?.value||'').replace(',','.'));
    const perfPreview=document.getElementById('performanceScorePreview');
    if(perfPreview) perfPreview.textContent=Number.isFinite(rs)&&ps!=null?String(Math.round(rs+ps)):'–';
  }

  function late(preserve=true){
    [0,30,120,350].forEach(ms=>setTimeout(()=>rebuildAndSync(preserve),ms));
  }

  patchEngine();
  const event=document.getElementById('event');
  const category=document.getElementById('category');
  const placing=document.getElementById('placing');
  const resultScore=document.getElementById('resultScore');
  event?.addEventListener('change',()=>late(false));
  category?.addEventListener('change',()=>late(false));
  placing?.addEventListener('change',()=>late(true));
  resultScore?.addEventListener('input',()=>late(true));
  resultScore?.addEventListener('change',()=>late(true));
  document.getElementById('combinedWindStatus')?.addEventListener('change',()=>late(true));
  document.getElementById('calculate')?.addEventListener('click',()=>late(true));
  setTimeout(()=>late(true),500);

  window.__WA2026_PLACING_TABLES__=TABLES;
})();
