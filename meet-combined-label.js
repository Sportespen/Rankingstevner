// Stevnefinner: combined-events ranking group is shown as "Mangekamp" in card event fields.
(() => {
'use strict';
function isCombined(){const v=document.getElementById('event')?.value||'';return v==='Decathlon'||v==='Heptathlon';}
function apply(){
  if(!isCombined()) return;
  document.querySelectorAll('.meet-card-v1').forEach(card=>{
    card.querySelectorAll('.meet-facts > div').forEach(box=>{
      const label=box.querySelector('span')?.textContent?.trim()||'';
      if(label==='Øvelse'){
        const value=box.querySelector('strong');
        if(value) value.textContent='Mangekamp';
      }
    });
  });
}
const host=()=>document.getElementById('meetList');
function install(){
  const h=host();
  if(h)new MutationObserver(()=>requestAnimationFrame(apply)).observe(h,{childList:true,subtree:true});
  document.getElementById('event')?.addEventListener('change',()=>setTimeout(apply,30));
  document.getElementById('sex')?.addEventListener('change',()=>setTimeout(apply,30));
  apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();