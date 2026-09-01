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
    const requestKey=`${name}|${date}|${indoor}|${document.getElementById('event')?.value||''}|${document.getElementById('sex')?.value||''}`;
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
// A rankingbasisupdated-triggered refresh (clearing every card's requestKey and re-running apply())
// was tried here to fix a real but minor issue - the athlete's own PB sometimes loading after a
// card's history fetch had already resolved, leaving the green comparison line empty on that card
// until the next full re-render. Reverted: rankingbasisupdated can fire more than once during
// normal page activity (event/sex change, WA-ID load, official-ranking.js settling), and each
// firing reset EVERY card back to the "Søker i World Athletics-kalenderen …" loading state - live
// reports showed cards getting stuck looking like NO meet had historical results at all, a much
// worse regression than the narrow case it was meant to fix.
const observer=new MutationObserver(()=>requestAnimationFrame(apply));
document.addEventListener('DOMContentLoaded',()=>{
  const host=document.getElementById('meetList');if(host)observer.observe(host,{childList:true,subtree:true});
  apply();
  loadDedupe();
  loadCombinedVenueLabels();
});
})();
