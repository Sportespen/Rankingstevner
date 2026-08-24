// Rankingstevner v0.8.8 – isolert klientstyrt søkeflyt
(function () {
  const input = document.getElementById('athleteNameSearch');
  let box = document.getElementById('athleteSearchResults');
  const waId = document.getElementById('waProfileId');
  const load = document.getElementById('loadWaProfile');
  if (!input || !box || !waId || !load) return;

  // Viktig: den gamle v0.8.6-koden har en MutationObserver på det opprinnelige
  // resultatfeltet. Den observeren kan trigge seg selv i en endeløs løkke.
  // Bytt derfor ut selve DOM-noden. Den gamle observeren blir hengende på en
  // frakoblet node, mens denne søkemotoren får et rent resultatfelt.
  const cleanBox = box.cloneNode(false);
  box.replaceWith(cleanBox);
  box = cleanBox;

  const INDEX_KEY = 'rankingstevner.athleteIndex.v2';
  const seed = [
    {id:14989292, firstName:'Jonathan', lastName:'Hertwig-Ødegaard', country:'NOR'}
  ];
  let requestNo = 0;
  let timer = null;

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
    if(name===nq)s+=10000;
    if(name.startsWith(nq))s+=9000;
    else if(name.includes(nq))s+=4000;
    for(const t of qt){
      if(nt.some(n=>n.startsWith(t)))s+=2500;
      else if(name.includes(t))s+=800;
      else return 0;
    }
    return s;
  }
  function localMatches(q){
    return readIndex().map(a=>({a,s:score(a,q)})).filter(x=>x.s>0)
      .sort((x,y)=>y.s-x.s||fullName(x.a).localeCompare(fullName(y.a),'no'))
      .slice(0,8).map(x=>x.a);
  }
  function render(list,message){
    if(message){
      box.innerHTML=`<div style="padding:12px" class="muted">${message}</div>`;
      box.style.display='block';
      return;
    }
    if(!list.length){ box.style.display='none'; box.innerHTML=''; return; }
    box.innerHTML='';
    for(const a of list){
      const b=document.createElement('button');
      b.type='button';
      b.style.cssText='display:block;width:100%;padding:11px 12px;text-align:left;border:0;border-bottom:1px solid #edf2f0;background:#fff;cursor:pointer';
      b.innerHTML=`<strong>${fullName(a)||a.id}</strong><br><span class="muted">${a.country?`${a.country} · `:''}WA-ID ${a.id}</span>`;
      b.addEventListener('click',()=>{
        input.value=fullName(a);
        waId.value=String(a.id);
        saveAthlete(a);
        box.style.display='none';
        load.click();
      });
      box.appendChild(b);
    }
    box.style.display='block';
  }
  function mergeRank(q,local,remote){
    const map=new Map();
    for(const a of [...local,...remote]) if(a?.id&&!map.has(String(a.id))) map.set(String(a.id),a);
    return [...map.values()].map(a=>({a,s:score(a,q)})).filter(x=>x.s>0)
      .sort((x,y)=>y.s-x.s||fullName(x.a).localeCompare(fullName(y.a),'no'))
      .slice(0,12).map(x=>x.a);
  }
  async function remoteSearch(q,local,myRequest){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),1800);
    try{
      const res=await fetch(`/api/athlete-search?q=${encodeURIComponent(q)}&v=088`,{cache:'no-store',signal:controller.signal});
      const data=await res.json();
      if(myRequest!==requestNo || input.value.trim()!==q) return;
      const remote=Array.isArray(data?.results)?data.results:[];
      render(mergeRank(q,local,remote));
    }catch(_){
      if(myRequest===requestNo && !local.length) render([], 'Søket bruker litt tid. Skriv én bokstav til.');
    }finally{ clearTimeout(timeout); }
  }

  // Capture gjør at den gamle input-handleren aldri får kjøre.
  input.addEventListener('input',(ev)=>{
    ev.stopImmediatePropagation();
    clearTimeout(timer);
    const q=input.value.trim();
    requestNo++;
    if(q.length<1){ box.style.display='none'; box.innerHTML=''; return; }

    // Lokale kjente treff vises allerede fra første bokstav. Ingen nettverkskall
    // gjøres før to tegn er skrevet.
    const local=localMatches(q);
    if(local.length) render(local); else if(q.length>=2) render([], 'Søker…'); else { box.style.display='none'; box.innerHTML=''; }
    if(q.length<2) return;

    const myRequest=requestNo;
    timer=setTimeout(()=>remoteSearch(q,local,myRequest),180);
  },true);
})();
