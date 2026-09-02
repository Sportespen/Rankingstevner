// Guarantees "Ny Ranking Score"-boksen (resultBox) alltid nullstilles ved øvelse- eller
// kjønnsbytte. Flere eksisterende script (gender-reset.js, ranking-basis-reset-v0168.js,
// trinn3.js sin egen "Nullstill"-knapp) prøver allerede delvis dette ved kjønnsbytte, men ingen
// av dem lytter på selve øvelsesvalget (#event) i det hele tatt - så et bytte av øvelse lot gamle
// "Ny Ranking Score"/"+X rankingpoeng"-tall for FEIL øvelse bli stående synlig.
(() => {
  'use strict';
  function resetResultBox(){
    document.getElementById('resultBox')?.classList.add('hidden');
    ['resultScoreOut','placingScoreOut','performanceScoreOut','newRankingOut','newRankPositionOut'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.textContent='–';
    });
    ['improvement','currentRankingLine','replaceInfo','ruleInfo'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.textContent='';
    });
  }
  function boot(){
    const eventSelect=document.getElementById('event');
    const sex=document.getElementById('sex');
    if(!eventSelect||!sex){setTimeout(boot,100);return;}
    if(document.documentElement.dataset.resultBoxResetInstalled==='1') return;
    document.documentElement.dataset.resultBoxResetInstalled='1';
    eventSelect.addEventListener('change',resetResultBox);
    sex.addEventListener('change',resetResultBox);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
