// Rankingstevner v0.8.9 – smartere og roligere navnesøk
(function () {
  const input = document.getElementById('athleteNameSearch');
  let box = document.getElementById('athleteSearchResults');
  const waId = document.getElementById('waProfileId');
  const load = document.getElementById('loadWaProfile');
  if (!input || !box || !waId || !load) return;

  // Koble helt fra gammel resultatnode/observer.
  const cleanBox = box.cloneNode(false);
  box.replaceWith(cleanBox);
  box = cleanBox;

  const INDEX_KEY = 'rankingstevner.athleteIndex.v2';
  const seed = [
    {id:14989292, firstName:'Jonathan', lastName:'Hertwig-Ødegaard', country:'NOR'}
  ];
  let requestNo = 0;
  let timer = null;
  let activeIndex = -1;
  let visibleResults = [];

  function norm(s){
    return String(s||'').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a')
      .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function fullName(a){ return `${a.firstName||''} ${a.lastName||''}`.trim(); }
  function readIndex(){
    let list=[];
    try{ list=JSON.parse(localStorage.getItem(INDEX_KEY)||'[]')||[]; }catch(_){ list=[]; }
    try{
      const p=JSON.parse(localStorage.getItem('rankingstevner.profile.v1')||'{}')||{};
      if(p.waId&&(p.waName||p.name)){
        const parts=String(p.waName||p.name).trim().split(/\s+/);
        list.unshift({id:Number(p.waId),firstName:parts.shift()||'',lastName:parts.join(' '),country:p.waData?.country||''});
      }
    }catch(_){}
    list.push(...seed);
    const map=new Map();
    for(const a of list){ if(a?.id) map.set(String(a.id),a); }
    return [...map.values()].slice(0,100);
  }
  function saveAthlete(a){
    const list=readIndex().filter(x=>String(x.id)!==String(a.id));
    list.unshift(a);
    localStorage.setItem(INDEX_KEY,JSON.stringify(list.slice(0,100)));
  }
  function score(a,q){
    const nq=norm(q), name=norm(fullName(a));
    if(!nq||!name) return 0;
    const qt=nq.split(' '), nt=name.split(' ');
    let s=0;
    if(name===nq)s+=12000;
    if(name.startsWith(nq))s+=10000;
    else if(name.includes(nq))s+=4500;
    for(const t of qt){
      if(nt.some(n=>n.startsWith(t)))s+=3000;
      else if(name.includes(t))s+=900;
      else return 0;
    }
    if(qt.length>1){
      const last=qt[qt.length-1];
      const athleteLast=norm(a.lastName);
      if(athleteLast.startsWith(last)) s+=7000;
    }
    return s;
  }
  function localMatches(q){
    return readIndex().map(a=>({a,s:score(a,q)})).filter(x=>x.s>0)
      .sort((x,y)=>y.s-x.s||fullName(x.a).localeCompare(fullName(y.a),'no'))
      .slice(0,5).map(x=>x.a);
  }
  function selectAthlete(a){
    input.value=fullName(a);
    waId.value=String(a.id);
    saveAthlete(a);
    box.style.display='none';
    load.click();
  }
  function paintActive(){
    [...box.querySelectorAll('[data-athlete-row]')].forEach((el,i)=>{
      el.style.background=i===activeIndex?'#eef8f5':'#fff';
    });
  }
  function render(list,{message='',hint=''}={}){
    visibleResults=list||[];
    activeIndex=-1;
    if(message){
      box.innerHTML=`<div style="padding:12px" class="muted">${message}</div>`;
      box.style.display='block';
      return;
    }
    if(!visibleResults.length){ box.style.display='none'; box.innerHTML=''; return; }
    box.innerHTML='';
    for(const a of visibleResults){
      const b=document.createElement('button');
      b.type='button';
      b.dataset.athleteRow='1';
      b.style.cssText='display:block;width:100%;padding:11px 12px;text-align:left;border:0;border-bottom:1px solid #edf2f0;background:#fff;cursor:pointer';
      b.innerHTML=`<strong>${fullName(a)||a.id}</strong><br><span class="muted">${a.country?`${a.country} · `:''}WA-ID ${a.id}</span>`;
      b.addEventListener('mouseenter',()=>{
        activeIndex=[...box.querySelectorAll('[data-athlete-row]')].indexOf(b);
        paintActive();
      });
      b.addEventListener('click',()=>selectAthlete(a));
      box.appendChild(b);
    }
    if(hint){
      const foot=document.createElement('div');
      foot.className='muted';
      foot.style.cssText='padding:8px 12px;background:#f8faf9;font-size:.9em';
      foot.textContent=hint;
      box.appendChild(foot);
    }
    box.style.display='block';
  }
  function mergeRank(q,local,remote){
    const map=new Map();
    for(const a of [...local,...remote]) if(a?.id&&!map.has(String(a.id))) map.set(String(a.id),a);
    return [...map.values()].map(a=>({a,s:score(a,q)})).filter(x=>x.s>0)
      .sort((x,y)=>y.s-x.s||fullName(x.a).localeCompare(fullName(y.a),'no'))
      .slice(0,8).map(x=>x.a);
  }
  async function remoteSearch(q,local,myRequest){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),1600);
    try{
      const res=await fetch(`/api/athlete-search?q=${encodeURIComponent(q)}&v=089`,{cache:'no-store',signal:controller.signal});
      const data=await res.json();
      if(myRequest!==requestNo || input.value.trim()!==q) return;
      const remote=Array.isArray(data?.results)?data.results:[];
      const merged=mergeRank(q,local,remote);
      render(merged,{hint:merged.length>1?'Velg riktig utøver fra listen.':''});
    }catch(_){
      if(myRequest===requestNo && !local.length) render([], {message:'Ingen raske treff. Skriv litt mer av navnet.'});
    }finally{ clearTimeout(timeout); }
  }

  input.addEventListener('input',(ev)=>{
    ev.stopImmediatePropagation();
    clearTimeout(timer);
    const q=input.value.trim();
    requestNo++;
    if(q.length<1){ box.style.display='none'; box.innerHTML=''; return; }

    const local=localMatches(q);
    if(local.length){
      render(local,{hint:q.length===1?'Skriv én bokstav til for flere World Athletics-treff.':''});
    } else if(q.length>=2) {
      render([], {message:'Søker…'});
    } else {
      box.style.display='none'; box.innerHTML='';
    }
    if(q.length<2) return;

    const myRequest=requestNo;
    timer=setTimeout(()=>remoteSearch(q,local,myRequest),140);
  },true);

  input.addEventListener('keydown',(ev)=>{
    if(box.style.display==='none' || !visibleResults.length) return;
    if(ev.key==='ArrowDown'){
      ev.preventDefault();
      activeIndex=(activeIndex+1)%visibleResults.length;
      paintActive();
    } else if(ev.key==='ArrowUp'){
      ev.preventDefault();
      activeIndex=(activeIndex<=0?visibleResults.length:activeIndex)-1;
      paintActive();
    } else if(ev.key==='Enter' && activeIndex>=0){
      ev.preventDefault();
      selectAthlete(visibleResults[activeIndex]);
    } else if(ev.key==='Escape'){
      box.style.display='none';
    }
  },true);
})();
