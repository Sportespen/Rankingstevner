// Rankingstevner v0.19.0 – første levende Stevnefinner
(() => {
  'use strict';
  function boot(){
    const meetList=document.getElementById('meetList');
    const eventSelect=document.getElementById('event');
    if(!meetList||!eventSelect){setTimeout(boot,100);return;}
    const section=meetList.closest('section');
    if(!section||section.dataset.liveMeetFinder==='190')return;
    section.dataset.liveMeetFinder='190';

    const head=section.querySelector('.section-head');
    if(head){
      const muted=head.querySelector('.muted'); if(muted) muted.textContent='World Athletics-kalender';
      const h3=head.querySelector('h3'); if(h3) h3.textContent='Aktuelle rankingstevner i Europa';
    }

    const filters=section.querySelector('.filters');
    if(filters){
      filters.innerHTML=`
        <select id="meetEventFilter"><option value="current">Valgt øvelse</option><option value="all">Alle øvelser</option></select>
        <select id="meetCategoryFilter"><option value="all">Alle kategorier</option><option>GW</option><option>GL</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option><option>F</option></select>
        <select id="meetPeriodFilter"><option value="90">Neste 90 dager</option><option value="180">Neste 6 måneder</option><option value="365">Neste 12 måneder</option><option value="all">Alle tilgjengelige</option></select>`;
    }

    const status=document.createElement('p');
    status.id='meetFinderStatus'; status.className='muted'; status.style.margin='10px 0 12px';
    meetList.parentNode.insertBefore(status,meetList);

    let all=[];
    const aliases={
      '100m':['100 m','100m'],'200m':['200 m','200m'],'400m':['400 m','400m'],'800m':['800 m','800m'],'1500m':['1500 m','1500m'],'5000m':['5000 m','5000m'],'10000m':['10,000 m','10000 m','10 000 m'],'100mH':['100 m hurdles','100m hurdles'],'110mH':['110 m hurdles','110m hurdles'],'400mH':['400 m hurdles','400m hurdles'],'3000mSC':['3000 m steeplechase','3000m steeplechase'],'HJ':['high jump'],'PV':['pole vault'],'LJ':['long jump'],'TJ':['triple jump'],'SP':['shot put'],'DT':['discus throw'],'HT':['hammer throw'],'JT':['javelin throw'],'Decathlon':['decathlon'],'Heptathlon':['heptathlon']
    };

    function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
    function eventMatches(m){
      const mode=document.getElementById('meetEventFilter')?.value||'current';
      if(mode==='all') return true;
      const terms=(aliases[eventSelect.value]||[]).map(norm);
      if(!terms.length)return true;
      const hay=(m.disciplines||[]).map(norm).join(' | ');
      return terms.some(t=>hay.includes(t));
    }
    function catCode(v){
      const s=String(v||'').toUpperCase();
      for(const c of ['OW','DF','GW','GL','A','B','C','D','E','F']) if(s===c||s.includes(` ${c}`)||s.startsWith(c+' ')) return c;
      return s;
    }
    function dateVal(v){const d=v?new Date(v):null;return d&&!isNaN(d)?d:null;}
    function fmtDate(m){
      const a=dateVal(m.start),b=dateVal(m.end); if(!a)return 'Dato ikke oppgitt';
      const f=d=>d.toLocaleDateString('no-NO',{day:'2-digit',month:'2-digit',year:'numeric'});
      return b&&b.toDateString()!==a.toDateString()?`${f(a)} – ${f(b)}`:f(a);
    }
    function inEurope(m){
      // WA-kalenderen brukes som kilde. Vi filtrerer bort tydelige ikke-europeiske regionnavn her,
      // men lar ukjente steder være med fremfor å skjule gyldige europeiske stevner.
      const s=norm(`${m.location} ${m.competitionGroup} ${m.competitionSubgroup}`);
      const non=['united states','usa','canada','australia','new zealand','japan','china','india','kenya','ethiopia','south africa','brazil','argentina','mexico','jamaica','qatar','uae','saudi'];
      return !non.some(x=>s.includes(x));
    }
    function filter(){
      const cat=document.getElementById('meetCategoryFilter')?.value||'all';
      const period=document.getElementById('meetPeriodFilter')?.value||'90';
      const now=new Date(); now.setHours(0,0,0,0);
      const max=period==='all'?null:new Date(now.getTime()+Number(period)*86400000);
      const list=all.filter(m=>{
        const start=dateVal(m.start); if(start&&start<now)return false;
        if(max&&start&&start>max)return false;
        if(cat!=='all'&&catCode(m.rankingCategory)!==cat)return false;
        return inEurope(m)&&eventMatches(m);
      }).sort((a,b)=>(dateVal(a.start)?.getTime()||9e15)-(dateVal(b.start)?.getTime()||9e15));
      render(list);
    }
    async function showDetails(id,host){
      host.innerHTML='<span class="muted">Henter kontakt- og stevneinformasjon …</span>';
      try{
        const r=await fetch(`/api/meet-details?id=${encodeURIComponent(id)}&v=190`,{cache:'no-store'}); const d=await r.json();
        if(!d.ok)throw new Error(d.error||'Kunne ikke hente detaljer');
        const x=d.details||{}; const contacts=Array.isArray(x.contactPersons)?x.contactPersons:[];
        const contactText=contacts.length?contacts.map(c=>[c.name,c.role,c.email,c.phone].filter(Boolean).join(' · ')).join('<br>'):'Ingen kontaktperson oppgitt i WA.';
        const prizes=x.prizeMoney&&Object.keys(x.prizeMoney).length?JSON.stringify(x.prizeMoney):'Ikke oppgitt';
        host.innerHTML=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e3ece9"><strong>Kontakt/påmelding</strong><div>${contactText}</div><div style="margin-top:6px"><strong>Premier:</strong> ${prizes}</div>${x.websiteUrl?`<div style="margin-top:6px"><a href="${x.websiteUrl}" target="_blank" rel="noopener">Stevnets nettside</a></div>`:''}</div>`;
      }catch(e){host.innerHTML=`<span class="muted">${e.message}</span>`;}
    }
    function render(list){
      status.textContent=list.length?`${list.length} aktuelle stevner funnet.`:'Ingen treff med valgte filtre.';
      meetList.innerHTML=list.slice(0,80).map(m=>{
        const ev=(m.disciplines||[]).slice(0,8).join(', ')||'Øvelser ikke oppgitt';
        return `<article class="meet-card" style="padding:16px;border:1px solid #d9e5e1;border-radius:14px;background:#fff;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start"><div><h4 style="margin:0 0 5px">${m.name||'Navnløst stevne'}</h4><div class="muted">${fmtDate(m)} · ${m.location||'Sted ikke oppgitt'}</div></div><span class="badge">${catCode(m.rankingCategory)||'–'}</span></div><div style="margin-top:9px;font-size:13px"><strong>Øvelser:</strong> ${ev}</div><button type="button" class="secondary" data-meet-details="${m.id}" style="margin-top:10px">Kontakt, premier og info</button><div data-details-host="${m.id}"></div></article>`;
      }).join('');
      meetList.querySelectorAll('[data-meet-details]').forEach(b=>b.addEventListener('click',()=>showDetails(b.dataset.meetDetails,meetList.querySelector(`[data-details-host="${b.dataset.meetDetails}"]`))));
    }
    async function load(){
      status.textContent='Henter World Athletics-kalender …'; meetList.innerHTML='';
      try{
        const r=await fetch('/api/meet-search?v=190',{cache:'no-store'}); const d=await r.json();
        if(!d.ok)throw new Error(d.error||'Kunne ikke hente stevner');
        all=Array.isArray(d.results)?d.results:[]; filter();
      }catch(e){status.textContent=`Kunne ikke hente stevnekalender: ${e.message}`;}
    }
    ['meetEventFilter','meetCategoryFilter','meetPeriodFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',filter));
    eventSelect.addEventListener('change',filter);
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
