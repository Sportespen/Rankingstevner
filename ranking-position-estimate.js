// Rankingstevner - estimated new world-ranking POSITION for a simulated result, found by
// locating where the new Ranking Score would fall in World Athletics' current ranking list
// for that event. This is an estimate: other athletes' scores can change before the result
// is official, so it's only ever labelled "(estimat)", never shown as a confirmed position.
(function(){
  'use strict';

  function boot(){
    const calculateBtn=document.getElementById('calculate');
    const eventSelect=document.getElementById('event');
    const sex=document.getElementById('sex');
    const waInput=document.getElementById('waProfileId');
    const newRankingOut=document.getElementById('newRankingOut');
    const out=document.getElementById('newRankPositionOut');
    if(!calculateBtn||!eventSelect||!sex||!waInput||!newRankingOut||!out){setTimeout(boot,150);return;}
    if(calculateBtn.dataset.rankPositionInstalled) return;
    calculateBtn.dataset.rankPositionInstalled='1';

    let seq=0;
    async function updatePosition(){
      const mySeq=++seq;
      const id=waInput.value.trim().match(/(\d{7,9})/)?.[1];
      const newScore=Number(newRankingOut.textContent);
      if(!id||!Number.isFinite(newScore)||newScore<=0){ out.textContent='–'; return; }
      out.textContent='…';
      try{
        const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&newScore=${encodeURIComponent(newScore)}&v=1`,{cache:'no-store'});
        const data=await res.json();
        if(mySeq!==seq)return;
        out.textContent=Number.isFinite(data?.estimatedNewRank)&&data.estimatedNewRank>0?`#${data.estimatedNewRank}`:'–';
      }catch(_){
        if(mySeq===seq) out.textContent='–';
      }
    }

    calculateBtn.addEventListener('click',()=>setTimeout(updatePosition,80));

    // A fresh simulation (event/sex/WA-ID change, or Nullstill) makes the old position stale.
    const resetToDash=()=>{ seq++; out.textContent='–'; };
    eventSelect.addEventListener('change',resetToDash);
    sex.addEventListener('change',resetToDash);
    waInput.addEventListener('change',resetToDash);
    document.getElementById('clearProfile')?.addEventListener('click',resetToDash);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
