// Rankingstevner - estimated new EUROPEAN ranking POSITION for a simulated result, found by
// locating where the new Ranking Score would fall in the ranking list this app can actually walk
// page by page (api.european-athletics.com's EA_TRPC gateway - see functions/api/
// wa-official-ranking.js). That list is Europe-scoped, confirmed via live diagnostics (an
// athlete's real World Athletics world rank, sourced directly from WA's own GraphQL backend via
// nimarion, was 3532nd, while this list - despite its proc being misleadingly named
// "worldAthletics.getRanking" - only has ~1800 rows total and still found him around 1250th: a
// European athlete placing far better among Europeans only than among the whole world). No
// full GLOBAL ranking list is available to this app to walk instead (nimarion only exposes a
// single current-place snapshot per athlete, not a list), so this is unavoidably a European
// estimate - labelled as such in the UI ("Ny plassering (Europa)"), never presented as a world
// rank. It's also still only an estimate in the ordinary sense: other athletes' scores can
// change before a result is official.
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

    // A dash alone doesn't say WHY the estimate is missing - it's built on a live World
    // Athletics/EA lookup chain (nimarion profile -> EA's world-ranking pages -> a page-walk to
    // find where the new score would land) that can fall short in several distinct ways (WA-ID
    // not resolvable, athlete not found in the ranking list, the ranking-page fetch itself
    // failing). Surfacing the backend's own diagnostics here - same pattern already used for
    // "Historisk nivå" and the official-ranking box - beats needing dev tools to find out.
    function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
    function diagBox(){
      let box=document.getElementById('newRankPositionDiag');
      if(!box){
        box=document.createElement('details');
        box.id='newRankPositionDiag';
        box.style.cssText='margin-top:6px;font-size:11px;color:#677585;grid-column:1/-1';
        box.innerHTML='<summary style="cursor:pointer">Diagnostikk (ny rankingplassering)</summary><pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;background:#f7f9fb;padding:8px;border-radius:6px;margin-top:6px"></pre>';
        out.closest('.result-grid')?.insertAdjacentElement('afterend',box);
      }
      return box;
    }
    function showDiag(payload){
      const box=diagBox();
      box.querySelector('pre').textContent=JSON.stringify(payload,null,2);
    }

    let seq=0;
    async function updatePosition(){
      const mySeq=++seq;
      const id=waInput.value.trim().match(/(\d{7,9})/)?.[1];
      const newScore=Number(newRankingOut.textContent);
      if(!id||!Number.isFinite(newScore)||newScore<=0){ out.textContent='–'; showDiag({reason:!id?'mangler-wa-id':'mangler-gyldig-ny-score',id:id||null,newScore}); return; }
      out.textContent='…';
      try{
        const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&newScore=${encodeURIComponent(newScore)}&v=1`,{cache:'no-store'});
        const data=await res.json();
        if(mySeq!==seq)return;
        const ok=Number.isFinite(data?.estimatedNewEuropeanRank)&&data.estimatedNewEuropeanRank>0;
        out.textContent=ok?`#${data.estimatedNewEuropeanRank}`:'–';
        showDiag({status:res.status,estimatedNewEuropeanRank:data?.estimatedNewEuropeanRank??null,name:data?.name||null,worldRank:data?.rankScope==='world'?data?.rank:null,europeanRank:data?.europeanRank??null,diagnostics:data?.diagnostics||[]});
      }catch(e){
        if(mySeq===seq){ out.textContent='–'; showDiag({source:'fetch',error:String(e?.message||e)}); }
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
