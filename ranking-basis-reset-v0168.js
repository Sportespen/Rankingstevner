// Rankingstevner v0.16.8 – hindre at rankinggrunnlag fra forrige kjønn/profil henger igjen
(() => {
  'use strict';

  function boot(){
    const sex=document.getElementById('sex');
    const waInput=document.getElementById('waProfileId');
    const waDetails=document.getElementById('waProfileDetails');
    if(!sex||!waInput||!waDetails){setTimeout(boot,100);return;}
    if(document.documentElement.dataset.rankingBasisReset0168==='1') return;
    document.documentElement.dataset.rankingBasisReset0168='1';

    function clearHiddenScores(){
      document.querySelectorAll('.existingScore').forEach(el=>{
        el.value='';
        el.dispatchEvent(new Event('input',{bubbles:true}));
      });
      document.querySelectorAll('.existingType').forEach(el=>el.value='main');
    }

    function clearBasisUi(){
      document.getElementById('autoRankingBasisAllEvents')?.remove();
      clearHiddenScores();
      const resultBox=document.getElementById('resultBox');
      if(resultBox) resultBox.classList.add('hidden');
    }

    // Ved manuelt kjønnsskifte skal gammelt rankinggrunnlag bort umiddelbart.
    sex.addEventListener('change',ev=>{
      if(!ev.isTrusted) return;
      clearBasisUi();
      // De andre reset-rutinene tømmer WA-ID rett etterpå. Kjør igjen etter dem.
      setTimeout(clearBasisUi,0);
      setTimeout(clearBasisUi,100);
      setTimeout(clearBasisUi,350);
    },true);

    // ranking-basis.js kan forsøke å tegne gamle resultater fra minnet etter kjønnsskiftet.
    // Så lenge ingen ny WA-ID er valgt, fjernes dette automatisk.
    const observer=new MutationObserver(()=>{
      if(!waInput.value.trim()){
        const stale=document.getElementById('autoRankingBasisAllEvents');
        if(stale) stale.remove();
        clearHiddenScores();
      }
    });
    observer.observe(waDetails,{childList:true,subtree:true});

    waInput.addEventListener('input',()=>{
      if(!waInput.value.trim()) clearBasisUi();
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
