// Rankingstevner - fetches the athlete's real World Athletics world rank (see
// functions/api/wa-official-ranking.js) and exposes it for ranking-basis.js's own box to show
// alongside its already-WA-sourced Ranking Score reconstruction. Used to run its own separate
// "Offisiell WA Ranking Score" box sourced partly from api.european-athletics.com - removed
// entirely once live diagnostics showed that source's rank/score is a different, smaller
// population (Europe-only, not the world) despite its proc being named "worldAthletics.getRanking".
// This file no longer renders anything itself - just fetches the one number that's genuinely
// WA-direct (the rank) and lets ranking-basis.js's box display it.
(function(){'use strict';
const eventSelect=document.getElementById('event'),sex=document.getElementById('sex'),waInput=document.getElementById('waProfileId'),waStatus=document.getElementById('waProfileStatus');if(!eventSelect||!sex||!waInput)return;
let requestSeq=0;

// Unrelated to the WA-vs-EA ranking fix above - kept as-is from the original file. Rebuilding
// the #event dropdown on a sex change (app.js's populateEvents) drops whichever hurdle option
// doesn't apply to the new sex, but doesn't auto-select its equivalent - this swaps the
// selection itself (110mH<->100mH) so switching sex doesn't silently fall back to some other
// event entirely.
function ensureSexSpecificHurdle(){
  const women=sex.value==='W',want=women?'100mH':'110mH',wrong=women?'110mH':'100mH',wantLabel=women?'100 m hekk':'110 m hekk';
  const wasWrong=eventSelect.value===wrong;
  [...eventSelect.options].filter(o=>o.value===wrong).forEach(o=>o.remove());
  let wanted=[...eventSelect.options].find(o=>o.value===want);
  if(!wanted){
    wanted=document.createElement('option');wanted.value=want;wanted.textContent=wantLabel;
    const before=[...eventSelect.options].find(o=>o.value==='400mH');
    if(before)eventSelect.insertBefore(wanted,before);else eventSelect.appendChild(wanted);
  }else wanted.textContent=wantLabel;
  if(wasWrong){eventSelect.value=want;setTimeout(()=>eventSelect.dispatchEvent(new Event('change',{bubbles:true})),0);}
}

async function load(){
  ensureSexSpecificHurdle();
  const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
  if(!id){ window.__rankingstevnerOfficialRanking=null; window.dispatchEvent(new CustomEvent('rankingofficialloaded')); return; }
  const seq=++requestSeq;
  const event=eventSelect.value;
  let data=null;
  try{
    const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(event)}&v=230`,{cache:'no-store'});
    data=await res.json();
  }catch(e){ data={ok:false,error:String(e?.message||e)}; }
  if(seq!==requestSeq)return;
  const hasRank=data?.ok&&Number.isFinite(Number(data?.rank))&&Number(data.rank)>0;
  window.__rankingstevnerOfficialRanking={
    event,
    rank:hasRank?Number(data.rank):null,
    name:data?.name||null,
    source:'World Athletics (via nimarion)',
    diagnostics:data?.diagnostics||(data?.error?[{source:'fetch',error:data.error}]:[])
  };
  window.dispatchEvent(new CustomEvent('rankingofficialloaded'));
}

eventSelect.addEventListener('change',()=>setTimeout(load,80));
sex.addEventListener('change',()=>setTimeout(load,120));
waInput.addEventListener('change',()=>setTimeout(load,20));
if(waStatus)new MutationObserver(()=>{if(waInput.value.trim())setTimeout(load,60);}).observe(waStatus,{childList:true,subtree:true,characterData:true});
setTimeout(load,500);
})();
