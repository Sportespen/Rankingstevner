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
// The athlete's own best mark (ranking-basis.js's window.__rankingstevnerOwnResults) loads on a
// separate async chain from this box's own WA-history fetch - confirmed live: on the same page
// load, one card's history fetch resolved before the athlete's own PB was ready (empty green
// comparison line, "Historisk nivå" numbers still shown fine) while another card's resolved after
// (comparison line present), purely by network timing. requestKey above intentionally blocks a
// re-FETCH of the same card (that WA lookup is slow), but the comparison line is computed fresh
// from window.__rankingstevnerOwnResults in renderHtml() every time htmlAsync() runs - so once the
// athlete's own results are actually ready, clearing the key lets already-finished cards recompute
// their placeLine using the now-cached (instant, no new network call) fetchHistory result.
function refreshForOwnResults(){
  document.querySelectorAll('.meet-insight[data-history-request-key]').forEach(el=>{delete el.dataset.historyRequestKey;});
  apply();
}
const observer=new MutationObserver(()=>requestAnimationFrame(apply));
document.addEventListener('DOMContentLoaded',()=>{
  const host=document.getElementById('meetList');if(host)observer.observe(host,{childList:true,subtree:true});
  apply();
  loadDedupe();
  loadCombinedVenueLabels();
});
window.addEventListener('rankingbasisupdated',()=>requestAnimationFrame(refreshForOwnResults));
})();
