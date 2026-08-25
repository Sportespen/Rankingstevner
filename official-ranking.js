// Rankingstevner v0.19.7 – stabil offisiell WA Ranking Score
(function(){
  'use strict';

  const eventSelect=document.getElementById('event');
  const sex=document.getElementById('sex');
  const waInput=document.getElementById('waProfileId');
  const waStatus=document.getElementById('waProfileStatus');
  const waDetails=document.getElementById('waProfileDetails');
  if(!eventSelect||!sex||!waInput||!waDetails)return;

  let currentKey='';
  let official=null;
  let loading=false;

  function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>0;}

  function patch(){
    if(!official||!validScore(official.score))return;
    const score=Number(official.score);
    const rank=Number(official.rank);
    const label=eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;

    const first=waDetails.firstElementChild;
    if(first && !first.id){
      first.innerHTML=`<strong>Rankinggrunnlag for ${label}:</strong><br>${Number.isFinite(rank)&&rank>0?`#${rank} · `:''}<strong>${score} Ranking Score</strong>`;
    }

    let auto=document.getElementById('autoRankingBasisAllEvents');
    if(!auto){
      auto=document.createElement('div');
      auto.id='autoRankingBasisAllEvents';
      waDetails.appendChild(auto);
    }

    let left=auto.querySelector('.ranking-basis-left');
    if(!left){left=document.createElement('div');left.className='ranking-basis-left';auto.appendChild(left);}
    left.innerHTML=`<strong>Offisielt rankinggrunnlag for ${label}:</strong><br><span class="muted">Nåværende Ranking Score og plassering er hentet fra World Athletics. Lokal beregning brukes bare når en ny prestasjon simuleres.</span>`;

    let card=auto.querySelector('.ranking-score-card');
    if(!card){
      card=document.createElement('div');
      card.className='ranking-score-card';
      card.innerHTML='<div class="ranking-score-label"></div><div class="ranking-score-value"></div><div class="ranking-score-note"></div>';
      auto.appendChild(card);
    }
    const cardLabel=card.querySelector('.ranking-score-label');
    const value=card.querySelector('.ranking-score-value');
    const note=card.querySelector('.ranking-score-note');
    if(cardLabel)cardLabel.textContent='OFFISIELL WA RANKING SCORE';
    if(value)value.textContent=String(score);
    if(note)note.textContent='Hentet fra World Athletics.';

    window.__rankingstevnerOfficialRanking={event:eventSelect.value,score,rank:Number.isFinite(rank)&&rank>0?rank:null,source:'World Athletics'};
  }

  async function load(force=false){
    const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
    if(!id||loading)return;
    const key=`${id}:${eventSelect.value}:${sex.value}`;
    if(!force&&key===currentKey&&official){patch();return;}
    loading=true;
    try{
      const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&v=197`,{cache:'no-store'});
      const data=await res.json();
      currentKey=key;
      official=(data?.ok&&validScore(data?.score))?data:null;
      if(official){
        patch();
        // Ranking-basis kan bli ferdig noen millisekunder senere. To kontrollerte repatcher
        // vinner den racen uten MutationObserver-loop og uten hopping.
        setTimeout(patch,300);
        setTimeout(patch,800);
      }
    }catch(_){
      official=null;
    }finally{loading=false;}
  }

  eventSelect.addEventListener('change',()=>setTimeout(()=>load(true),120));
  sex.addEventListener('change',()=>setTimeout(()=>load(true),150));
  waInput.addEventListener('change',()=>setTimeout(()=>load(true),30));

  if(waStatus){
    new MutationObserver(()=>{
      const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
      if(id)setTimeout(()=>load(true),80);
    }).observe(waStatus,{childList:true,subtree:true,characterData:true});
  }

  // Viktig: vi observerer IKKE waDetails. Den gamle observeren reagerte på sine egne
  // DOM-endringer og skapte en kontinuerlig render-loop som fikk scorekortet til å hoppe.
  setTimeout(()=>load(true),500);
})();
