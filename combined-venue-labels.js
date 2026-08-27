// Stevnefinner + event selector: combined events use the shared ranking-group label "Mangekamp" for both sexes.
// Arena remains a separate filter (innendørs/utendørs); calculator logic and underlying event codes are untouched.
(() => {
  'use strict';
  let scheduled=false;

  function setBox(card,label,value){
    const box=[...card.querySelectorAll('.meet-facts>div')].find(x=>x.querySelector('span')?.textContent.trim()===label);
    const strong=box?.querySelector('strong');
    if(strong && strong.textContent!==value) strong.textContent=value;
  }

  function relabelEventOption(){
    const event=document.getElementById('event');
    if(!event) return;
    [...event.options].forEach(opt=>{
      if((opt.value==='Decathlon'||opt.value==='Heptathlon') && opt.textContent!=='Mangekamp'){
        opt.textContent='Mangekamp';
      }
    });
  }

  function apply(){
    scheduled=false;
    const event=document.getElementById('event');
    const host=document.getElementById('meetList');
    relabelEventOption();
    if(!event||!host) return;
    const code=event.value;
    if(code!=='Decathlon'&&code!=='Heptathlon') return;

    host.querySelectorAll('.meet-card-v1').forEach(card=>setBox(card,'Øvelse','Mangekamp'));

    const summary=host.querySelector('.finder-summary h4');
    if(summary && summary.textContent!=='Mangekamp') summary.textContent='Mangekamp';
  }

  function queue(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const host=document.getElementById('meetList');
    const event=document.getElementById('event');
    if(host) new MutationObserver(queue).observe(host,{childList:true,subtree:true});
    if(event) new MutationObserver(queue).observe(event,{childList:true,subtree:true});
    document.addEventListener('change',e=>{
      if(['finderVenue','event','sex'].includes(e.target?.id)) setTimeout(queue,0);
    });
    relabelEventOption();
    queue();
  });
})();
