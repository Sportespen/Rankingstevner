// Inject verified historical level into Stevnefinner cards after each render.
(() => {
'use strict';
let busy=false;
function apply(){
  if(busy)return; busy=true;
  try{
    const api=window.RankingstevnerMeetHistory;if(!api)return;
    document.querySelectorAll('.meet-card-v1').forEach(card=>{
      const name=card.querySelector('h4')?.textContent?.trim()||'';
      const boxes=[...card.querySelectorAll('.meet-insight')];
      const history=boxes.find(x=>/historisk nivå/i.test(x.textContent||''));
      if(!history)return;
      const html=api.html(name);
      if(history.dataset.historyHtml===html)return;
      history.dataset.historyHtml=html;
      history.innerHTML=`<span>Historisk nivå</span>${html}`;
    });
  } finally {busy=false;}
}
function loadDedupe(){
  if(document.querySelector('script[data-meet-dedupe]'))return;
  const s=document.createElement('script');
  s.src='meet-dedupe.js?v=2';
  s.dataset.meetDedupe='1';
  document.head.appendChild(s);
}
const observer=new MutationObserver(()=>requestAnimationFrame(apply));
document.addEventListener('DOMContentLoaded',()=>{
  const host=document.getElementById('meetList');if(host)observer.observe(host,{childList:true,subtree:true});
  apply();
  loadDedupe();
});
})();
