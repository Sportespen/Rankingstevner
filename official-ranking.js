// Rankingstevner v0.20.0 – separat visning for offisiell WA-ranking
(function(){
  'use strict';
  const eventSelect=document.getElementById('event');
  const sex=document.getElementById('sex');
  const waInput=document.getElementById('waProfileId');
  const waStatus=document.getElementById('waProfileStatus');
  const legacy=document.getElementById('waProfileDetails');
  if(!eventSelect||!sex||!waInput||!legacy)return;

  let mount=document.getElementById('officialWaRankingDetails');
  if(!mount){
    mount=document.createElement('div');
    mount.id='officialWaRankingDetails';
    mount.style.cssText='display:block;margin-top:14px;margin-bottom:8px;padding:14px;border:1px solid #d9e5e1;border-radius:10px;background:#fff';
    legacy.insertAdjacentElement('afterend',mount);
  }

  let requestSeq=0;
  function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>0;}
  function label(){return eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;}
  function renderLoading(){mount.innerHTML=`<strong>Rankinggrunnlag for ${label()}:</strong><br><span class="muted">Henter offisiell ranking fra World Athletics …</span>`;}
  function renderNone(){mount.innerHTML=`<strong>Rankinggrunnlag for ${label()}:</strong><br><span class="muted">Ingen offisiell WA-ranking funnet for denne øvelsen.</span>`;window.__rankingstevnerOfficialRanking=null;}
  function render(data){
    const score=Number(data.score),rank=Number(data.rank),heading=label();
    mount.innerHTML=`<div style="display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:18px;align-items:stretch"><div><strong>Rankinggrunnlag for ${heading}:</strong><br>${Number.isFinite(rank)&&rank>0?`#${rank} · `:''}<strong>${score} Ranking Score</strong><br><br><strong>Offisielt rankinggrunnlag for ${heading}:</strong><br><span class="muted">Ranking Score og plassering er hentet fra World Athletics. Lokal beregning brukes bare når en ny prestasjon simuleres.</span></div><div style="background:#f7fbfa;border:1px solid #cfe2dc;border-radius:14px;padding:22px 18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><div style="font-size:13px;letter-spacing:.12em;font-weight:900;color:#0f766e">OFFISIELL WA RANKING SCORE</div><div style="font-size:52px;line-height:1;font-weight:900;color:#0b4f4a;margin:14px 0 10px">${score}</div><div style="font-size:12px;color:#677585">Hentet fra World Athletics.</div></div></div>`;
    window.__rankingstevnerOfficialRanking={event:eventSelect.value,score,rank:Number.isFinite(rank)&&rank>0?rank:null,source:'World Athletics'};
  }

  async function fetchOnce(id,seq){
    const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&v=200&t=${Date.now()}`,{cache:'no-store'});
    const data=await res.json();
    if(seq!==requestSeq)return null;
    return data;
  }

  async function load(){
    const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
    if(!id){mount.innerHTML='';return;}
    const seq=++requestSeq;
    renderLoading();
    for(let attempt=0;attempt<3;attempt++){
      try{
        const data=await fetchOnce(id,seq);
        if(seq!==requestSeq)return;
        if(data?.ok&&validScore(data?.score)){render(data);return;}
      }catch(_){ }
      if(attempt<2)await new Promise(r=>setTimeout(r,350*(attempt+1)));
    }
    if(seq===requestSeq)renderNone();
  }

  eventSelect.addEventListener('change',()=>setTimeout(load,80));
  sex.addEventListener('change',()=>setTimeout(load,120));
  waInput.addEventListener('change',()=>setTimeout(load,20));
  if(waStatus)new MutationObserver(()=>{if(waInput.value.trim())setTimeout(load,60);}).observe(waStatus,{childList:true,subtree:true,characterData:true});
  setTimeout(load,500);
})();