// Inject verified historical level into Stevnefinner cards after each render.
(() => {
'use strict';
function apply(){
  const api=window.RankingstevnerMeetHistory;if(!api)return;
  document.querySelectorAll('.meet-card-v1').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim()||'';
    const date=card.dataset.meetStart||'';
    const indoor=card.dataset.meetIndoor==='1';
    const boxes=[...card.querySelectorAll('.meet-insight')];
    const history=boxes.find(x=>/historisk nivå/i.test(x.textContent||''));
    if(!history)return;
    const requestKey=`${name}|${date}|${indoor}|${document.getElementById('event')?.value||''}`;
    if(history.dataset.historyRequestKey===requestKey)return;
    history.dataset.historyRequestKey=requestKey;
    history.innerHTML=`<span>Historisk nivå</span>${api.loadingHtml}`;
    api.htmlAsync(name,date,indoor).then(html=>{
      if(history.dataset.historyRequestKey!==requestKey)return; // card moved on to a different meet/event since
      history.innerHTML=`<span>Historisk nivå</span>${html}`;
    });
  });
}
function loadDedupe(){
  if(document.querySelector('script[data-meet-dedupe]'))return;
  const s=document.createElement('script');
  s.src='meet-dedupe.js?v=3';
  s.dataset.meetDedupe='1';
  document.head.appendChild(s);
}
function loadCombinedVenueLabels(){
  if(document.querySelector('script[data-combined-venue-labels]'))return;
  const s=document.createElement('script');
  s.src='combined-venue-labels.js?v=2';
  s.dataset.combinedVenueLabels='1';
  document.head.appendChild(s);
}
const observer=new MutationObserver(()=>requestAnimationFrame(apply));
document.addEventListener('DOMContentLoaded',()=>{
  const host=document.getElementById('meetList');if(host)observer.observe(host,{childList:true,subtree:true});
  apply();
  loadDedupe();
  loadCombinedVenueLabels();
});
})();
