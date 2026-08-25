// Rankingstevner v0.17.1 – generelt og raskt navnesøk for alle utøvere
(() => {
  'use strict';

  function boot(){
    const input=document.getElementById('profileName');
    const waInput=document.getElementById('waProfileId');
    const waButton=document.getElementById('loadWaProfile');
    if(!input||!waInput||!waButton){setTimeout(boot,80);return;}
    if(input.dataset.fastAthleteSearch==='1') return;
    input.dataset.fastAthleteSearch='1';

    const host=input.parentElement;
    if(!host) return;
    host.style.position='relative';
    let box=document.getElementById('profileNameSearchResults');
    if(!box){
      box=document.createElement('div');
      box.id='profileNameSearchResults';
      box.style.cssText='display:none;position:absolute;left:0;right:0;top:100%;z-index:80;background:#fff;border:1px solid #d5dfdf;border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.10);max-height:320px;overflow:auto;margin-top:4px';
      host.appendChild(box);
    }

    const pool=new Map();
    const responseCache=new Map();
    let timer=null, requestNo=0, controller=null, visible=[];

    function norm(s){
      return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
    }
    function fullName(a){return `${a.firstName||''} ${a.lastName||''}`.trim();}
    function matches(a,q){
      const qt=norm(q).split(' ').filter(Boolean), nt=norm(fullName(a)).split(' ').filter(Boolean);
      if(!qt.length||!nt.length) return false;
      return qt.every(t=>nt.some(n=>n.startsWith(t)||n.includes(t)));
    }
    function rank(a,q){
      const nq=norm(q), name=norm(fullName(a));
      let s=0;
      if(name===nq)s+=12000;
      if(name.startsWith(nq))s+=9000;
      const qt=nq.split(' ').filter(Boolean), first=norm(a.firstName), last=norm(a.lastName);
      if(qt[0]&&first.startsWith(qt[0]))s+=3500;
      if(qt.length>1&&last.startsWith(qt.at(-1)))s+=6000+qt.at(-1).length*200;
      return s;
    }
    function localMatches(q){
      return [...pool.values()].filter(a=>matches(a,q)).sort((a,b)=>rank(b,q)-rank(a,q)||fullName(a).localeCompare(fullName(b),'no')).slice(0,12);
    }
    function addToPool(list){for(const a of list||[])if(a?.id)pool.set(String(a.id),a);}

    function select(a){
      input.value=fullName(a);
      waInput.value=String(a.id);
      box.style.display='none';
      waButton.click();
    }
    function render(list,message=''){
      visible=list||[];
      if(!visible.length){
        if(message){box.innerHTML=`<div style="padding:10px 12px;color:#677585">${message}</div>`;box.style.display='block';}
        else {box.innerHTML='';box.style.display='none';}
        return;
      }
      box.innerHTML=visible.map((a,i)=>{
        const meta=[a.country,a.birthDate?String(a.birthDate).slice(0,10):'',`WA-ID ${a.id}`].filter(Boolean).join(' · ');
        return `<button type="button" data-fast-athlete="${i}" style="display:block;width:100%;padding:10px 12px;text-align:left;border:0;border-bottom:1px solid #edf2f0;background:#fff;cursor:pointer"><strong>${fullName(a)||a.id}</strong><br><span style="color:#677585;font-size:12px">${meta}</span></button>`;
      }).join('');
      [...box.querySelectorAll('[data-fast-athlete]')].forEach(btn=>btn.addEventListener('click',()=>select(visible[Number(btn.dataset.fastAthlete)])));
      box.style.display='block';
    }

    async function remote(q,myRequest){
      const key=norm(q);
      if(responseCache.has(key)){
        const list=responseCache.get(key); addToPool(list); render(localMatches(q)); return;
      }
      controller?.abort();
      controller=new AbortController();
      try{
        const res=await fetch(`/api/athlete-search?q=${encodeURIComponent(q)}&v=171`,{cache:'no-store',signal:controller.signal});
        const data=await res.json();
        if(myRequest!==requestNo||input.value.trim()!==q)return;
        const list=Array.isArray(data?.results)?data.results:[];
        responseCache.set(key,list); addToPool(list);
        const ranked=localMatches(q);
        render(ranked,ranked.length?'':'Ingen utøvere funnet.');
      }catch(err){
        if(err?.name==='AbortError')return;
        if(myRequest===requestNo&&!localMatches(q).length)render([],'Søket bruker litt tid.');
      }
    }

    // Capture-fasen stopper det eldre, tregere søket i trinn3.js.
    input.addEventListener('input',ev=>{
      ev.stopImmediatePropagation();
      clearTimeout(timer);
      const q=input.value.trim();
      requestNo++;
      if(q.length<2){controller?.abort();render([]);return;}
      const local=localMatches(q);
      if(local.length)render(local);else render([],'Søker…');
      const mine=requestNo;
      timer=setTimeout(()=>remote(q,mine),90);
    },true);

    document.addEventListener('click',e=>{if(e.target!==input&&!box.contains(e.target))box.style.display='none';});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
