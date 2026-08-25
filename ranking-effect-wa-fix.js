// Rankingstevner v0.22.3 – bruk offisielt WA-rankinggrunnlag direkte i «Beregn rankingeffekt»
(() => {
  'use strict';

  function syncOfficialBasisIntoCalculator(){
    const official=window.__rankingstevnerOfficialRanking;
    const event=document.getElementById('event');
    const scoreEls=[...document.querySelectorAll('.existingScore')];
    const typeEls=[...document.querySelectorAll('.existingType')];

    if(!official || !event || official.event!==event.value || !scoreEls.length) return false;

    const basis=Array.isArray(official.basis) ? official.basis : [];
    const scores=basis
      .map(row=>Number(row?.performanceScore))
      .filter(v=>Number.isFinite(v) && v>0)
      .slice(0,scoreEls.length);

    if(scores.length<scoreEls.length) return false;

    scoreEls.forEach((el,i)=>{ el.value=String(scores[i]); });
    typeEls.forEach(el=>{ el.value='main'; });
    return true;
  }

  function init(){
    const calculate=document.getElementById('calculate');
    if(!calculate){ setTimeout(init,100); return; }
    if(calculate.dataset.waBasisFix==='1') return;
    calculate.dataset.waBasisFix='1';

    // Kjør før den opprinnelige kalkulator-listeneren. Da slipper brukeren å fylle
    // de skjulte, gamle manuelle Performance Score-feltene.
    calculate.addEventListener('click',()=>{
      syncOfficialBasisIntoCalculator();
    },true);

    window.addEventListener('rankingofficialloaded',()=>{
      setTimeout(syncOfficialBasisIntoCalculator,0);
    });

    const event=document.getElementById('event');
    event?.addEventListener('change',()=>setTimeout(syncOfficialBasisIntoCalculator,150));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
