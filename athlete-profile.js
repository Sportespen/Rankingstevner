// Rankingstevner v0.8.1 – øvelse først + synkronisert navne/WA-søk
(function () {
  const STORAGE_KEY = "rankingstevner.profile.v1";
  const profileName = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatus");
  const saveProfileBtn = document.getElementById("saveProfile");
  const clearProfileBtn = document.getElementById("clearProfile");
  const sex = document.getElementById("sex");
  const eventSelect = document.getElementById("event");
  const waInput = document.getElementById('waProfileId');
  const waBtn = document.getElementById('loadWaProfile');
  const waStatus = document.getElementById('waProfileStatus');
  const waDetails = document.getElementById('waProfileDetails');
  const nameSearch = document.getElementById('athleteNameSearch');
  const nameResults = document.getElementById('athleteSearchResults');
  const nameModeBtn = document.getElementById('searchByName');
  const idModeBtn = document.getElementById('searchById');
  const nameBlock = document.getElementById('nameSearchBlock');
  const idBlock = document.getElementById('idSearchBlock');

  const combinedPlacing = {
    OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],
    DF:[125,105,95,85,75,67,60,53,35,28,24,21],
    GW:[100,85,75,65,56,49,42,35,25,21,17,13],
    GL:[80,65,55,46,39,35,31,28,21,17,14,11],
    A:[56,49,42,35,31,27,24,21,15,13,11,9],
    B:[42,35,31,27,24,21,18,15,13,11,9,8],
    C:[32,27,22,18,15,13,12,11,10,9,8,7],
    D:[21,15,13,11,10,9,8,7], E:[14,10,7,6,5,4], F:[7,4,2]
  };

  if (!profileName || !profileStatus || !saveProfileBtn || !clearProfileBtn || !sex || !eventSelect) return;

  function readStore(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{};}catch(_){return{};} }
  function writeStore(store){ localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); }
  function eventKey(){ return `${sex.value}:${eventSelect.value||""}`; }
  function collectScores(){
    const scores=[...document.querySelectorAll('.existingScore')];
    const types=[...document.querySelectorAll('.existingType')];
    return scores.map((el,i)=>({score:el.value,type:types[i]?.value||'main'}));
  }
  function clearScores(){
    document.querySelectorAll('.existingScore').forEach(el=>el.value='');
    document.querySelectorAll('.existingType').forEach(el=>el.value='main');
  }
  function applyScores(saved){
    clearScores();
    if(!Array.isArray(saved)) return;
    const scores=[...document.querySelectorAll('.existingScore')];
    const types=[...document.querySelectorAll('.existingType')];
    saved.forEach((item,i)=>{
      if(scores[i]) scores[i].value=item?.score??'';
      if(types[i]) types[i].value=item?.type==='similar'?'similar':'main';
    });
  }
  function showStatus(text,good=true){ profileStatus.textContent=text; profileStatus.style.color=good?'#087f5b':'#677585'; }
  // Name/sex/WA-ID are already visible in the fields right above - the WA status line just
  // needs to say whether the search is running, succeeded or failed, not repeat them.
  function setWaStatus(text,tone){ if(!waStatus)return; waStatus.textContent=text; waStatus.style.color=tone==='good'?'#087f5b':tone==='bad'?'#677585':''; }
  function normalizeEvent(s){
    return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/[^a-z0-9]+/g,'');
  }
  function normalizeProxyEventGroup(s){
    return String(s||'').replace(/^Men'?s\s+/i,'').replace(/^Women'?s\s+/i,'').replace(/^Woman'?s\s+/i,'').trim();
  }
  function currentEventLabel(){ return eventSelect.options[eventSelect.selectedIndex]?.textContent || eventSelect.value; }
  function isCombinedSelected(){ return eventSelect.value==='Decathlon'||eventSelect.value==='Heptathlon'; }
  function rankingMatchesSelected(r){
    const selected=normalizeEvent(eventSelect.value||currentEventLabel());
    const ev=normalizeEvent(r?.event);
    return selected===ev || (selected==='decathlon'&&ev==='decathlon') || (selected==='heptathlon'&&ev==='heptathlon');
  }

  function combinedType(discipline,athleteSex){
    const d=String(discipline||'').toLowerCase().trim();
    if(athleteSex==='M'){
      if(d==='decathlon') return 'main';
      if(d.includes('heptathlon short track')) return 'similar';
    }
    if(athleteSex==='W'){
      if(d==='heptathlon') return 'main';
      if(d.includes('pentathlon short track')) return 'similar';
    }
    return null;
  }
  function buildCombinedRankingBasis(results,athleteSex){
    if(!Array.isArray(results)) return null;
    const entries=results.map(r=>{
      const type=combinedType(r.discipline,athleteSex), resultScore=Number(r.resultScore), place=Number(r.place), category=String(r.category||'').toUpperCase();
      const placingScore=combinedPlacing[category]?.[place-1];
      if(!type||r.legal===false||!Number.isFinite(resultScore)||resultScore<=0||!Number.isFinite(place)||placingScore==null) return null;
      return {score:resultScore+placingScore,resultScore,placingScore,type,discipline:r.discipline,mark:r.mark,place,category,competition:r.competition,date:r.date};
    }).filter(Boolean);
    const validPairs=[];
    for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++){
      const pair=[entries[i],entries[j]];
      if(pair.some(x=>x.type==='main')) validPairs.push(pair);
    }
    if(!validPairs.length) return null;
    validPairs.sort((a,b)=>(b[0].score+b[1].score)-(a[0].score+a[1].score));
    const selected=validPairs[0].sort((a,b)=>b.score-a.score);
    return {selected,rankingScore:Math.floor((selected[0].score+selected[1].score)/2)};
  }

  function applyBasisForSelectedEvent(data){
    const store=readStore();
    const saved=store.scores?.[eventKey()];
    if(isCombinedSelected() && data?.combinedBasis?.selected?.length){
      setTimeout(()=>{
        const scores=[...document.querySelectorAll('.existingScore')];
        const types=[...document.querySelectorAll('.existingType')];
        clearScores();
        data.combinedBasis.selected.forEach((item,i)=>{
          if(scores[i]) scores[i].value=String(item.score);
          if(types[i]) types[i].value=item.type;
        });
        const s=readStore(); s.scores=s.scores||{}; s.scores[eventKey()]=collectScores(); writeStore(s);
      },100);
    } else if(saved){
      setTimeout(()=>applyScores(saved),80);
    } else {
      setTimeout(clearScores,80);
    }
  }

  function renderWaDetails(data){
    if(!waDetails) return;
    const selectedRank=(data.rankings||[]).find(r=>rankingMatchesSelected(r));
    const selectedScore=(data.rankingScores||[]).find(r=>rankingMatchesSelected(r));
    const heading=currentEventLabel();

    let rankingHtml=`<div><strong>Rankinggrunnlag for ${heading}:</strong><br>`;
    if(selectedRank){
      rankingHtml+=`#${selectedRank.rank} ${selectedRank.event}${selectedScore?.score?` · <strong>${selectedScore.score} Ranking Score</strong>`:''}`;
    }else{
      rankingHtml+=`Ingen gjeldende WA-ranking funnet for denne øvelsen.`;
    }
    rankingHtml+='</div>';

    let basisHtml='';
    if(isCombinedSelected() && data.combinedBasis?.selected?.length){
      const rows=data.combinedBasis.selected.map(x=>`${x.mark} ${x.discipline} · ${x.resultScore} Result Score + ${x.placingScore} Placing Score = <strong>${x.score} Performance Score</strong> (${x.type==='main'?'Main Event':'Similar Event'})`).join('<br>');
      basisHtml=`<div style="margin-top:10px;padding:10px;border-radius:8px;background:#eef8f5"><strong>Tellende Performance Scores:</strong><br>${rows}<br><strong>Ranking Score: ${data.combinedBasis.rankingScore}</strong></div>`;
    }else if(selectedRank){
      basisHtml=`<div class="muted" style="margin-top:8px">Rankingplasseringen er hentet. Automatisk uthenting av tellende Performance Scores for ${heading} bygges inn i neste datasteg.</div>`;
    }
    waDetails.innerHTML=rankingHtml+basisHtml;
    waDetails.style.display='block';
  }

  function setSearchMode(mode){
    const byName=mode==='name';
    if(nameBlock) nameBlock.style.display=byName?'block':'none';
    if(idBlock) idBlock.style.display=byName?'none':'block';
    if(nameModeBtn){nameModeBtn.className=byName?'primary':'secondary';}
    if(idModeBtn){idModeBtn.className=byName?'secondary':'primary';}
  }
  nameModeBtn?.addEventListener('click',()=>setSearchMode('name'));
  idModeBtn?.addEventListener('click',()=>setSearchMode('id'));

  let searchTimer=null;
  nameSearch?.addEventListener('input',()=>{
    const q=nameSearch.value.trim();
    clearTimeout(searchTimer);
    if(q.length<2){ if(nameResults) nameResults.style.display='none'; return; }
    searchTimer=setTimeout(()=>searchAthletes(q),250);
  });

  async function searchAthletes(q){
    if(!nameResults) return;
    nameResults.style.display='block';
    nameResults.innerHTML='<div style="padding:12px" class="muted">Søker…</div>';
    try{
      const res=await fetch(`/api/athlete-search?q=${encodeURIComponent(q)}&v=081`,{cache:'no-store'});
      const data=await res.json();
      if(!data.ok) throw new Error(data.error||'Søk feilet');
      if(!data.results?.length){nameResults.innerHTML='<div style="padding:12px" class="muted">Ingen utøvere funnet.</div>';return;}
      nameResults.innerHTML=data.results.map((a,i)=>{
        const full=`${a.firstName||''} ${a.lastName||''}`.trim();
        const meta=[a.country,a.birthDate?String(a.birthDate).slice(0,10):''].filter(Boolean).join(' · ');
        return `<button type="button" data-athlete-index="${i}" style="display:block;width:100%;padding:11px 12px;text-align:left;border:0;border-bottom:1px solid #edf2f0;background:#fff;cursor:pointer"><strong>${full||a.id}</strong>${meta?`<br><span class="muted">${meta} · WA-ID ${a.id}</span>`:`<br><span class="muted">WA-ID ${a.id}</span>`}</button>`;
      }).join('');
      [...nameResults.querySelectorAll('[data-athlete-index]')].forEach(btn=>btn.addEventListener('click',()=>{
        const a=data.results[Number(btn.dataset.athleteIndex)];
        const full=`${a.firstName||''} ${a.lastName||''}`.trim();
        if(nameSearch) nameSearch.value=full;
        if(waInput) waInput.value=String(a.id);
        nameResults.style.display='none';
        loadAthlete(String(a.id));
      }));
    }catch(e){ nameResults.innerHTML=`<div style="padding:12px" class="muted">Kunne ikke søke: ${e.message}</div>`; }
  }

  async function loadAthlete(id){
    if(!id) return;
    if(waBtn) waBtn.disabled=true;
    setWaStatus('Søker …');
    try{
      const [profileRes,rankRes,resultsRes]=await Promise.all([
        fetch(`/api/athlete?id=${encodeURIComponent(id)}&v=081`,{cache:'no-store'}),
        fetch(`/api/wa-rank?id=${encodeURIComponent(id)}&v=081`,{cache:'no-store'}),
        fetch(`/api/wa-results?id=${encodeURIComponent(id)}&v=081`,{cache:'no-store'})
      ]);
      const data=await profileRes.json(), rankData=await rankRes.json(), resultsData=await resultsRes.json();
      if(!data.ok) throw new Error(data.error||'Profiloppslag feilet');

      if(rankData?.ok&&Array.isArray(rankData.currentWorldRankings)){
        data.rankings=rankData.currentWorldRankings.map(r=>({rank:Number(r.place),event:normalizeProxyEventGroup(r.eventGroup)})).filter(r=>Number.isFinite(r.rank)&&r.event);
        if(!data.sex&&rankData.sex) data.sex=rankData.sex;
      }
      if(resultsData?.ok&&Array.isArray(resultsData.combined)){
        const basis=buildCombinedRankingBasis(resultsData.combined,data.sex);
        if(basis){
          data.combinedBasis=basis;
          const combinedRanking=(data.rankings||[]).find(r=>/decathlon|heptathlon/i.test(String(r.event||'')));
          data.rankingScores=[{event:data.sex==='W'?'Heptathlon':'Decathlon',rank:combinedRanking?.rank??null,score:basis.rankingScore,source:'calculated-from-wa-results'}];
        }
      }

      const store=readStore();
      store.waId=data.id; store.waName=data.name||store.name||''; store.waUrl=data.url; store.waRankings=data.rankings||[]; store.waData=data;
      if(data.name){ profileName.value=data.name; store.name=data.name; if(nameSearch) nameSearch.value=data.name; }
      if(waInput) waInput.value=String(data.id||id);
      if(data.sex&&[...sex.options].some(o=>o.value===data.sex)){
        sex.value=data.sex; sex.dispatchEvent(new Event('change')); store.sex=data.sex;
      }
      store.event=eventSelect.value; writeStore(store);
      setWaStatus('Koblet til World Athletics.','good');
      renderWaDetails(data);
      applyBasisForSelectedEvent(data);
    }catch(e){
      setWaStatus('Fant ikke WA-profil.');
      if(waDetails){waDetails.innerHTML='';waDetails.style.display='none';}
    }finally{ if(waBtn) waBtn.disabled=false; }
  }

  waBtn?.addEventListener('click',()=>{
    const id=waInput.value.trim().match(/(\d{7,9})/)?.[1];
    if(!id){setWaStatus('Skriv inn en gyldig WA-ID.');return;}
    loadAthlete(id);
  });

  function refreshForSelectedEvent(){
    const store=readStore();
    store.sex=sex.value; store.event=eventSelect.value; writeStore(store);
    if(store.waData){ renderWaDetails(store.waData); applyBasisForSelectedEvent(store.waData); }
    else setTimeout(()=>applyScores(store.scores?.[eventKey()]),60);
  }
  eventSelect.addEventListener('change',()=>setTimeout(refreshForSelectedEvent,60));
  sex.addEventListener('change',()=>setTimeout(refreshForSelectedEvent,100));

  saveProfileBtn.addEventListener('click',()=>{
    const store=readStore(); store.name=profileName.value.trim()||'Utøver'; store.sex=sex.value; store.event=eventSelect.value; store.scores=store.scores||{}; store.scores[eventKey()]=collectScores(); if(waInput?.value.trim()) store.waId=waInput.value.trim(); writeStore(store);
    showStatus(`Lagret for ${store.name}: ${currentEventLabel()}`);
  });
  clearProfileBtn.addEventListener('click',()=>{
    localStorage.removeItem(STORAGE_KEY); profileName.value=''; if(nameSearch) nameSearch.value=''; if(waInput) waInput.value=''; setWaStatus('Ingen WA-profil valgt.'); if(waDetails){waDetails.innerHTML='';waDetails.style.display='none';} clearScores();
    // "Nullstill profil" only cleared the profile fields themselves - the øvelse dropdown and
    // the official/local ranking boxes below (owned by official-ranking.js/ranking-basis.js,
    // separate scripts) kept showing whatever was last selected. Those two scripts' own 'change'
    // handlers no-op on an empty WA-ID (there's nothing to look up), so their boxes have to be
    // cleared here directly rather than relying on the dispatched events below alone.
    if(eventSelect.options.length)eventSelect.selectedIndex=0;
    const officialMount=document.getElementById('officialWaRankingDetails');if(officialMount)officialMount.innerHTML='';
    document.getElementById('autoRankingBasisAllEvents')?.remove();
    document.getElementById('rawCombinedDebugBox')?.remove();
    window.__rankingstevnerOfficialRanking=null;
    window.__rankingstevnerOfficialPending=false;
    window.__rankingstevnerReconstructedBasis=null;
    eventSelect.dispatchEvent(new Event('change',{bubbles:true}));
    if(waInput)waInput.dispatchEvent(new Event('change',{bubbles:true}));
  });

  function restoreProfile(){
    const store=readStore();
    if(store.name){profileName.value=store.name;if(nameSearch)nameSearch.value=store.name;}
    if(waInput&&store.waId)waInput.value=store.waId;
    if(store.sex&&[...sex.options].some(o=>o.value===store.sex))sex.value=store.sex;
    if(store.waName)setWaStatus('Koblet til World Athletics.','good');
    setTimeout(()=>{
      if(store.event&&[...eventSelect.options].some(o=>o.value===store.event))eventSelect.value=store.event;
      eventSelect.dispatchEvent(new Event('change'));
      if(store.waData){renderWaDetails(store.waData);applyBasisForSelectedEvent(store.waData);}
    },250);
  }

  setSearchMode('name');
  const wait=setInterval(()=>{if(eventSelect.options.length){clearInterval(wait);restoreProfile();}},100);
  setTimeout(()=>clearInterval(wait),10000);
})();
