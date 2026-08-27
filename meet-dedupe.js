// Stevnefinner: robust client-side duplicate guard.
// Same meeting name + date + country + category is shown only once,
// even if WA returns the same meeting with different venue/address formatting.
(function(){
  'use strict';
  let running=false;
  function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function fact(card,label){
    const boxes=[...card.querySelectorAll('.meet-facts>div')];
    const box=boxes.find(b=>norm(b.querySelector('span')?.textContent)===norm(label));
    return norm(box?.querySelector('strong')?.textContent||'');
  }
  function quality(card){
    let score=0;
    const meta=norm(card.querySelector('.meta')?.textContent||'');
    if(meta&&meta!=='sted ikke publisert') score+=2;
    if(card.querySelector('a[href*="worldathletics.org/competition/calendar-results/results/"]')) score+=4;
    if(!/hentes i neste steg/.test(norm(card.textContent))) score+=1;
    return score;
  }
  function run(){
    if(running) return;
    running=true;
    try{
      const host=document.getElementById('meetList');
      if(!host) return;
      const cards=[...host.querySelectorAll('.meet-card')];
      const kept=new Map();
      for(const card of cards){
        const name=norm(card.querySelector('h4')?.textContent||'');
        const date=fact(card,'Dato');
        const country=fact(card,'Land');
        const category=fact(card,'Stevnekategori')||norm(card.querySelector('.cat')?.textContent||'');
        if(!name||!date) continue;
        const key=[name,date,country,category].join('|');
        if(!kept.has(key)){kept.set(key,card);continue;}
        const old=kept.get(key);
        if(quality(card)>quality(old)){
          old.remove();kept.set(key,card);
        }else card.remove();
      }

      // Update visible count only when the number actually changed.
      // Rewriting the same text here would retrigger the MutationObserver forever.
      const count=host.querySelectorAll('.meet-card').length;
      const countEl=host.querySelector('.finder-count');
      if(countEl){
        const small=countEl.querySelector('small');
        const current=[...countEl.childNodes]
          .filter(n=>n.nodeType===Node.TEXT_NODE)
          .map(n=>n.textContent)
          .join('')
          .trim();
        const wanted=String(count);
        if(current!==wanted){
          [...countEl.childNodes]
            .filter(n=>n.nodeType===Node.TEXT_NODE)
            .forEach(n=>n.remove());
          countEl.insertBefore(document.createTextNode(wanted),small||null);
        }
      }
    } finally {
      running=false;
    }
  }
  function init(){
    const host=document.getElementById('meetList');
    if(!host){setTimeout(init,100);return;}
    let timer;
    new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(run,30);
    }).observe(host,{childList:true,subtree:true});
    run();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
