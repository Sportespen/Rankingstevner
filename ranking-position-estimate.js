// Rankingstevner - estimated new ranking POSITION for a simulated result ("Ny ranking"), found by
// locating where the already-computed "Ny Ranking Score" would fall in World Athletics' own public
// world-rankings list (worldathletics.org/world-rankings/{event}/{sex}). That page renders its
// table directly into the HTML server-side (confirmed live: real, global rows with an explicit
// Rank + score per athlete, 100 rows/page) - functions/api/wa-official-ranking.js walks it with a
// binary search over pages. Nothing here goes through api.european-athletics.com.
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

    // Was a visible "Diagnostikk (ny rankingplassering)" box shown on every calculation - useful
    // while this live chain (nimarion lookup -> WA world-rankings page-walk) was still being
    // verified, but not something regular users of the site should see. Now a no-op that just
    // clears any stale box left from before this change.
    function showDiag(){
      document.getElementById('newRankPositionDiag')?.remove();
    }

    let seq=0;
    async function updatePosition(){
      const mySeq=++seq;
      const id=waInput.value.trim().match(/(\d{7,9})/)?.[1];
      const newScore=Number(newRankingOut.textContent);
      if(!id||!Number.isFinite(newScore)||newScore<=0){ out.textContent='–'; showDiag({reason:!id?'mangler-wa-id':'mangler-gyldig-ny-score',id:id||null,newScore}); return; }
      out.textContent='…';
      // The backend chains several sequential external calls, each with its own server-side
      // timeout, but nothing previously bounded the OVERALL request from here - this forces a
      // resolution either way within 20s: always a real number or an honest "–", never a stuck
      // spinner.
      const controller=new AbortController();
      const timeoutId=setTimeout(()=>controller.abort(),20000);
      try{
        const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&newScore=${encodeURIComponent(newScore)}&v=1`,{cache:'no-store',signal:controller.signal});
        const data=await res.json();
        if(mySeq!==seq)return;
        const ok=Number.isFinite(data?.estimatedNewRank)&&data.estimatedNewRank>0;
        out.textContent=ok?`#${data.estimatedNewRank}`:'–';
        showDiag({status:res.status,estimatedNewRank:data?.estimatedNewRank??null,name:data?.name||null,worldRank:data?.rankScope==='world'?data?.rank:null,diagnostics:data?.diagnostics||[]});
      }catch(e){
        if(mySeq===seq){ out.textContent='–'; showDiag({source:'fetch',timedOut:e?.name==='AbortError',error:String(e?.message||e)}); }
      }finally{
        clearTimeout(timeoutId);
      }
    }

    calculateBtn.addEventListener('click',()=>setTimeout(updatePosition,80));

    // A fresh simulation (event/sex/WA-ID change, or Nullstill) makes the old position stale.
    const resetToDash=()=>{ seq++; out.textContent='–'; document.getElementById('newRankPositionDiag')?.remove(); };
    eventSelect.addEventListener('change',resetToDash);
    sex.addEventListener('change',resetToDash);
    waInput.addEventListener('change',resetToDash);
    document.getElementById('clearProfile')?.addEventListener('click',resetToDash);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
