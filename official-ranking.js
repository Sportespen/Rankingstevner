// Rankingstevner v0.19.8 – offisiell WA Ranking Score eier sluttvisningen
(function(){
  'use strict';
  const eventSelect=document.getElementById('event'),sex=document.getElementById('sex'),waInput=document.getElementById('waProfileId'),waStatus=document.getElementById('waProfileStatus'),waDetails=document.getElementById('waProfileDetails');
  if(!eventSelect||!sex||!waInput||!waDetails)return;
  let currentKey='',official=null,loading=false;
  function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>0;}
  function patch(){
    if(!official||!validScore(official.score))return;
    const score=Number(official.score),rank=Number(official.rank),label=eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;
    const first=waDetails.firstElementChild;
    if(first&&!first.id)first.innerHTML=`<strong>Rankinggrunnlag for ${label}:</strong><br>${Number.isFinite(rank)&&rank>0?`#${rank} · `:''}<strong>${score} Ranking Score</strong>`;
    let auto=document.getElementById('autoRankingBasisAllEvents');
    if(!auto){auto=document.createElement('div');auto.id='autoRankingBasisAllEvents';waDetails.appendChild(auto);}
    let left=auto.querySelector('.ranking-basis-left');if(!left){left=document.createElement('div');left.className='ranking-basis-left';auto.appendChild(left);}
    left.innerHTML=`<strong>Offisielt rankinggrunnlag for ${label}:</strong><br><span class="muted">Nåværende Ranking Score og plassering er hentet fra World Athletics. Lokal beregning brukes bare når en ny prestasjon simuleres.</span>`;
    let card=auto.querySelector('.ranking-score-card');if(!card){card=document.createElement('div');card.className='ranking-score-card';card.innerHTML='<div class="ranking-score-label"></div><div class="ranking-score-value"></div><div class="ranking-score-note"></div>';auto.appendChild(card);}
    card.querySelector('.ranking-score-label').textContent='OFFISIELL WA RANKING SCORE';card.querySelector('.ranking-score-value').textContent=String(score);card.querySelector('.ranking-score-note').textContent='Hentet fra World Athletics.';
    window.__rankingstevnerOfficialRanking={event:eventSelect.value,score,rank:Number.isFinite(rank)&&rank>0?rank:null,source:'World Athletics'};
  }
  async function load(force=false){
    const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';if(!id||loading)return;const key=`${id}:${eventSelect.value}:${sex.value}`;if(!force&&key===currentKey&&official){patch();return;}loading=true;
    try{const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&v=198`,{cache:'no-store'});const data=await res.json();currentKey=key;official=(data?.ok&&validScore(data?.score))?data:null;if(official)patch();}catch(_){official=null;}finally{loading=false;}
  }
  eventSelect.addEventListener('change',()=>setTimeout(()=>load(true),120));sex.addEventListener('change',()=>setTimeout(()=>load(true),150));waInput.addEventListener('change',()=>setTimeout(()=>load(true),30));
  if(waStatus)new MutationObserver(()=>{const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';if(id)setTimeout(()=>load(true),80);}).observe(waStatus,{childList:true,subtree:true,characterData:true});
  // Kun eksplisitt signal fra ranking-basis. Ingen DOM-observer på egen visning, altså ingen render-loop.
  window.addEventListener('rankingbasisrendered',()=>setTimeout(patch,0));
  setTimeout(()=>load(true),500);
})();