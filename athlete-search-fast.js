// Rankingstevner v0.18.3 – fornavn først, etternavn snevrer inn og vises umiddelbart
(() => {
  'use strict';

  function boot(){
    const input=document.getElementById('profileName');
    const waInput=document.getElementById('waProfileId');
    const waButton=document.getElementById('loadWaProfile');
    if(!input||!waInput||!waButton){setTimeout(boot,80);return;}
    if(input.dataset.fastAthleteSearch==='183') return;
    input.dataset.fastAthleteSearch='183';

    const host=input.parentElement;
    if(!host) return;
    host.style.position='relative';
    let box=document.getElementById('profileNameSearchResults');
    if(!box){
      box=document.createElement('div');
      box.id='profileNameSearchResults';
      box.style.cssText='display:none;position:absolute;left:0;right:0;top:100%;z-index:80;background:#0b1d33;border:1px solid #21405f;border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.35);max-height:320px;overflow:auto;margin-top:4px';
      host.appendChild(box);
    }

    const pool=new Map();
    const cache=new Map();
    const inflight=new Map();
    let timer=null, visible=[];

    function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
    function fullName(a){return `${a.firstName||''} ${a.lastName||''}`.trim();}
    function add(list){for(const a of list||[]) if(a?.id) pool.set(String(a.id),a);}
    function matches(a,q){
      const qt=norm(q).split(' ').filter(Boolean), nt=norm(fullName(a)).split(' ').filter(Boolean);
      return qt.length>0 && qt.every(t=>nt.some(n=>n.startsWith(t)||n.includes(t)));
    }
    function score(a,q){
      const nq=norm(q), name=norm(fullName(a)), first=norm(a.firstName), last=norm(a.lastName), qt=nq.split(' ').filter(Boolean);
      let s=0;
      if(name===nq)s+=20000;
      if(name.startsWith(nq))s+=12000;
      if(qt[0]&&first.startsWith(qt[0]))s+=6000;
      if(qt.length>1&&last.startsWith(qt.at(-1)))s+=9000+qt.at(-1).length*300;
      return s;
    }
    function localMatches(q){return [...pool.values()].filter(a=>matches(a,q)).sort((a,b)=>score(b,q)-score(a,q)||fullName(a).localeCompare(fullName(b),'no')).slice(0,15);}

    function select(a){
      input.value=fullName(a);
      waInput.value=String(a.id);
      box.style.display='none';
      waButton.click();
    }
    function render(list,message=''){
      visible=list||[];
      if(!visible.length){
        if(message){box.innerHTML=`<div style="padding:10px 12px;color:#aebed0">${message}</div>`;box.style.display='block';}
        else {box.innerHTML='';box.style.display='none';}
        return;
      }
      box.innerHTML=visible.map((a,i)=>{
        const meta=[a.country,a.birthDate?String(a.birthDate).slice(0,10):'',`WA-ID ${a.id}`].filter(Boolean).join(' · ');
        return `<button type="button" data-athlete="${i}" style="display:block;width:100%;padding:10px 12px;text-align:left;border:0;border-bottom:1px solid #21405f;background:#0b1d33;color:#f4f7fb;cursor:pointer"><strong>${fullName(a)||a.id}</strong><br><span style="color:#aebed0;font-size:12px">${meta}</span></button>`;
      }).join('');
      box.querySelectorAll('[data-athlete]').forEach(btn=>btn.addEventListener('click',()=>select(visible[Number(btn.dataset.athlete)])));
      box.style.display='block';
    }

    function fetchTerm(term){
      const key=norm(term);
      if(!key||key.length<2) return Promise.resolve([]);
      if(cache.has(key)) return Promise.resolve(cache.get(key));
      if(inflight.has(key)) return inflight.get(key);
      const p=fetch(`/api/athlete-search?q=${encodeURIComponent(term)}&v=183`,{cache:'no-store'})
        .then(r=>r.json())
        .then(data=>{
          const list=Array.isArray(data?.results)?data.results:[];
          cache.set(key,list);
          add(list);
          return list;
        })
        .catch(()=>[])
        .finally(()=>inflight.delete(key));
      inflight.set(key,p);
      return p;
    }

    function refreshCurrent(){
      const current=input.value.trim();
      if(!current) return;
      const found=localMatches(current);
      if(found.length) render(found);
    }

    function launch(term){
      return fetchTerm(term).then(()=>refreshCurrent());
    }

    async function searchNow(q){
      const parts=q.trim().split(/\s+/).filter(Boolean);
      const first=parts[0]||'';
      const last=parts.length>1?parts.at(-1):'';
      const tasks=[];

      const immediate=localMatches(q);
      if(immediate.length) render(immediate); else render([],'Søker…');

      // Viktig: når etternavnet er påbegynt prioriteres dette søket først,
      // fordi WA gir tidlige treff der. Hvert svar vises med én gang – vi venter
      // ikke lenger på at fornavn/fullt-navn-søk også skal bli ferdige.
      if(last && last!==first && last.length>=2) tasks.push(launch(last));

      // Brukeren søker fortsatt naturlig fornavn først.
      if(first.length>=3) tasks.push(launch(first));

      // Hele teksten brukes som ekstra presisering/fallback.
      if(q.length>=3) tasks.push(launch(q));

      if(!tasks.length){render([]);return;}
      await Promise.allSettled(tasks);

      if(input.value.trim()===q){
        const found=localMatches(q);
        render(found,found.length?'':'Ingen utøvere funnet.');
      }
    }

    input.addEventListener('input',ev=>{
      ev.stopImmediatePropagation();
      clearTimeout(timer);
      const q=input.value.trim();
      if(q.length<2){render([]);return;}
      const local=localMatches(q);
      if(local.length) render(local); else render([],'Søker…');
      timer=setTimeout(()=>searchNow(q),60);
    },true);

    document.addEventListener('click',e=>{if(e.target!==input&&!box.contains(e.target))box.style.display='none';});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
