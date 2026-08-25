// Rankingstevner v0.16.6 – nullstill profil og filtre ved manuelt kjønnsskifte
(() => {
  'use strict';

  function boot(){
    const sex=document.getElementById('sex');
    if(!sex || sex.dataset.genderResetInstalled==='1') return;
    sex.dataset.genderResetInstalled='1';

    sex.addEventListener('change',(ev)=>{
      // Bare når brukeren faktisk bytter kjønn i feltet.
      // Programmatisk kjønn satt etter WA-oppslag skal ikke slette profilen som nettopp ble hentet.
      if(!ev.isTrusted) return;

      const chosenSex=sex.value;

      // Fjern lagret profil/rankinggrunnlag, men behold valgt kjønn.
      try{
        localStorage.removeItem('rankingstevner.profile.v1');
      }catch(_){ }

      const profileName=document.getElementById('profileName');
      const waId=document.getElementById('waProfileId');
      const profileStatus=document.getElementById('profileStatus');
      const waStatus=document.getElementById('waProfileStatus');
      const waDetails=document.getElementById('waProfileDetails');
      const searchResults=document.getElementById('profileNameSearchResults');

      if(profileName) profileName.value='';
      if(waId) waId.value='';
      if(profileStatus){ profileStatus.textContent=''; profileStatus.style.color=''; }
      if(waStatus) waStatus.textContent='';
      if(waDetails){ waDetails.innerHTML=''; waDetails.style.display='none'; }
      if(searchResults){ searchResults.innerHTML=''; searchResults.style.display='none'; }

      // Nullstill hele «Ny prestasjon» etter at øvelseslisten er bygget om for nytt kjønn.
      setTimeout(()=>{
        const reset=document.getElementById('resetNewPerformance');
        if(reset) reset.click();
        else {
          const category=document.getElementById('category');
          const placing=document.getElementById('placing');
          const mark=document.getElementById('mark');
          const resultScore=document.getElementById('resultScore');
          const resultVisible=document.getElementById('resultDigits')||document.getElementById('resultEntryFallback');
          if(category) category.value='';
          if(placing) placing.value='';
          if(mark) mark.value='';
          if(resultScore) resultScore.value='';
          if(resultVisible) resultVisible.value='';
          ['resultScoreMirror','placingScorePreview','performanceScorePreview'].forEach(id=>{
            const el=document.getElementById(id); if(el) el.textContent='–';
          });
          document.getElementById('resultBox')?.classList.add('hidden');
        }
        // Sørg for at brukerens nye kjønn står urørt.
        sex.value=chosenSex;
      },80);
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
