// Stevnefinner: distinguish outdoor and indoor combined-event disciplines without touching calculator logic.
(() => {
  'use strict';
  let scheduled=false;

  function textOfBox(card,label){
    const box=[...card.querySelectorAll('.meet-facts>div')].find(x=>x.querySelector('span')?.textContent.trim()===label);
    return box?.querySelector('strong')?.textContent.trim()||'';
  }

  function setBox(card,label,value){
    const box=[...card.querySelectorAll('.meet-facts>div')].find(x=>x.querySelector('span')?.textContent.trim()===label);
    const strong=box?.querySelector('strong');
    if(strong) strong.textContent=value;
  }

  function combinedLabel(indoor,sex){
    if(indoor) return sex==='W'?'Femkamp':'Syvkamp';
    return sex==='W'?'Sjukamp':'Tikamp';
  }

  function apply(){
    scheduled=false;
    const event=document.getElementById('event');
    const sex=document.getElementById('sex')?.value||'M';
    const host=document.getElementById('meetList');
    if(!event||!host) return;
    const code=event.value;
    if(code!=='Decathlon'&&code!=='Heptathlon') return;

    host.querySelectorAll('.meet-card-v1').forEach(card=>{
      const arena=textOfBox(card,'Arena');
      const indoor=/innendørs/i.test(arena);
      const outdoor=/utendørs/i.test(arena);
      if(indoor) setBox(card,'Øvelse',combinedLabel(true,sex));
      else if(outdoor) setBox(card,'Øvelse',combinedLabel(false,sex));
      else setBox(card,'Øvelse',sex==='W'?'Mangekamp kvinner':'Mangekamp menn');
    });

    const summary=host.querySelector('.finder-summary h4');
    const venue=document.getElementById('finderVenue')?.value||'all';
    if(summary){
      if(venue==='indoor') summary.textContent=combinedLabel(true,sex);
      else if(venue==='outdoor') summary.textContent=combinedLabel(false,sex);
      else summary.textContent=sex==='W'?'Sjukamp / Femkamp':'Tikamp / Syvkamp';
    }
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