// Stevnefinner: combined events use the shared ranking-group label "Mangekamp" for both sexes.
// Arena remains a separate filter (innendørs/utendørs); calculator logic is untouched.
(() => {
  'use strict';
  let scheduled=false;

  function setBox(card,label,value){
    const box=[...card.querySelectorAll('.meet-facts>div')].find(x=>x.querySelector('span')?.textContent.trim()===label);
    const strong=box?.querySelector('strong');
    if(strong) strong.textContent=value;
  }

  function apply(){
    scheduled=false;
    const event=document.getElementById('event');
    const host=document.getElementById('meetList');
    if(!event||!host) return;
    const code=event.value;
    if(code!=='Decathlon'&&code!=='Heptathlon') return;

    // World Athletics ranks outdoor and indoor combined events in the same combined-events ranking group.
    host.querySelectorAll('.meet-card-v1').forEach(card=>setBox(card,'Øvelse','Mangekamp'));

    const summary=host.querySelector('.finder-summary h4');
    if(summary) summary.textContent='Mangekamp';
  }

  function queue(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const host=document.getElementById('meetList');
    if(host) new MutationObserver(queue).observe(host,{childList:true,subtree:true});
    document.addEventListener('change',e=>{
      if(['finderVenue','event','sex'].includes(e.target?.id)) setTimeout(queue,0);
    });
    queue();
  });
})();
