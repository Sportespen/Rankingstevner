// Rankingstevner v0.16.5 – automatisk WA-ID-oppslag + tydelig ventestatus
(function(){
  'use strict';

  function boot(){
    const waInput=document.getElementById('waProfileId');
    const waBtn=document.getElementById('loadWaProfile');
    const waStatus=document.getElementById('waProfileStatus');
    const clearBtn=document.getElementById('clearProfile');
    const profileStatus=document.getElementById('profileStatus');
    if(!waInput||!waBtn||!waStatus||!clearBtn||!profileStatus){setTimeout(boot,100);return;}
    if(document.documentElement.dataset.profileUx0165==='1') return;
    document.documentElement.dataset.profileUx0165='1';

    // Knappen er ikke lenger nødvendig i brukergrensesnittet. Den beholdes skjult
    // slik at eksisterende lastelogikk fortsatt kan gjenbrukes sikkert.
    waBtn.style.display='none';

    // Gi WA-ID-feltet mer plass når knappen er borte.
    const inline=waInput.closest('.wa-inline');
    if(inline){
      inline.style.gridTemplateColumns='1fr';
      inline.style.maxWidth='100%';
    }

    // Spinner/timeglass som vises mens World Athletics-data hentes.
    const style=document.createElement('style');
    style.textContent=`
      @keyframes waSpin0165{to{transform:rotate(360deg)}}
      .wa-spinner-0165{display:inline-block;width:14px;height:14px;margin-right:7px;border:2px solid #c5d6d2;border-top-color:#0f766e;border-radius:50%;vertical-align:-2px;animation:waSpin0165 .75s linear infinite}
    `;
    document.head.appendChild(style);

    function decorateLoading(){
      const txt=(waStatus.textContent||'').trim();
      if(/^Søker/i.test(txt) && !waStatus.querySelector('.wa-spinner-0165')){
        const spinner=document.createElement('span');
        spinner.className='wa-spinner-0165';
        spinner.setAttribute('aria-hidden','true');
        waStatus.prepend(spinner);
      }
    }

    const waObserver=new MutationObserver(()=>setTimeout(decorateLoading,0));
    waObserver.observe(waStatus,{childList:true,subtree:true,characterData:true});
    decorateLoading();

    // Fjern den unødvendige teksten etter nullstilling.
    function removeDeletedMessage(){
      if(/Profil og lagrede scores er slettet\.?/i.test(profileStatus.textContent||'')){
        profileStatus.textContent='';
        profileStatus.style.display='none';
      }
    }
    const profileObserver=new MutationObserver(()=>setTimeout(removeDeletedMessage,0));
    profileObserver.observe(profileStatus,{childList:true,subtree:true,characterData:true});
    clearBtn.addEventListener('click',()=>setTimeout(removeDeletedMessage,0));

    // Vis statusfeltet igjen når en ny profil faktisk er funnet/lastet.
    const restoreProfileStatus=new MutationObserver(()=>{
      const txt=(profileStatus.textContent||'').trim();
      if(txt && !/Profil og lagrede scores er slettet/i.test(txt)) profileStatus.style.display='block';
    });
    restoreProfileStatus.observe(profileStatus,{childList:true,subtree:true,characterData:true});

    // Automatisk oppslag når en gyldig WA-ID eller profil-lenke er ferdig skrevet.
    let timer=null;
    let lastRequested='';
    function extractId(){
      return waInput.value.trim().match(/(\d{7,9})/)?.[1] || '';
    }
    function scheduleLookup(){
      clearTimeout(timer);
      const id=extractId();
      if(!id){ lastRequested=''; return; }
      if(id===lastRequested) return;
      timer=setTimeout(()=>{
        const current=extractId();
        if(!current || current===lastRequested) return;
        lastRequested=current;
        waBtn.click();
      },350);
    }
    waInput.addEventListener('input',scheduleLookup);
    waInput.addEventListener('paste',()=>setTimeout(scheduleLookup,0));
    waInput.addEventListener('change',scheduleLookup);

    // Ved nullstilling kan samme ID søkes på nytt senere.
    clearBtn.addEventListener('click',()=>{
      clearTimeout(timer);
      lastRequested='';
      setTimeout(()=>{ waInput.value=''; },0);
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
