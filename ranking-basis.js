// Rankingstevner v0.21.3 – del rekonstruert rankinggrunnlag med offisiell WA-boks
(function(){
  const eventSelect=document.getElementById('event');
  const sex=document.getElementById('sex');
  const waInput=document.getElementById('waProfileId');
  const waStatus=document.getElementById('waProfileStatus');
  const waDetails=document.getElementById('waProfileDetails');
  if(!eventSelect||!sex||!waInput)return;

  if(!document.getElementById('rankingBasisLayoutStyle')){
    const style=document.createElement('style');
    style.id='rankingBasisLayoutStyle';
    style.textContent=`
      #autoRankingBasisAllEvents{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:18px;align-items:stretch}
      #autoRankingBasisAllEvents .ranking-basis-left{min-width:0}
      #autoRankingBasisAllEvents .ranking-score-card{background:#f7fbfa;border:1px solid #cfe2dc;border-radius:14px;padding:22px 18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;box-shadow:0 4px 16px rgba(24,39,52,.05)}
      #autoRankingBasisAllEvents .ranking-score-label{font-size:13px;letter-spacing:.12em;font-weight:900;color:#0f766e}
      #autoRankingBasisAllEvents .ranking-score-value{font-size:52px;line-height:1;font-weight:900;color:#0b4f4a;margin:14px 0 10px}
      #autoRankingBasisAllEvents .ranking-score-note{font-size:12px;color:#677585;line-height:1.4}
      #autoRankingBasisAllEvents .event-type-badge{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;vertical-align:2px;white-space:nowrap}
      #autoRankingBasisAllEvents .event-type-main{background:#e7f6f2;color:#087f5b}
      #autoRankingBasisAllEvents .event-type-similar{background:#eef2f7;color:#526170}
      #autoRankingBasisAllEvents .subevent-note{font-size:11px;color:#677585;margin-left:6px}
      #autoRankingBasisAllEvents .basis-note{font-size:12px;color:#677585;margin-top:8px;line-height:1.45}
      @media(max-width:850px){#autoRankingBasisAllEvents{grid-template-columns:1fr}.ranking-score-card{min-height:150px}}
    `;
    document.head.appendChild(style);
  }

  const SCORING_URL='https://raw.githubusercontent.com/lbouchard450/wa-scoring-tables/main/wa_scoring_tables_2025.min.json';
  const placingTables={
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };
  const req={standard:5,distance:3,tenk:2,combined:2};
  let currentId='',allResults=[],loading=false,scoringData=null;

  function group(code){if(code==='5000m'||code==='3000mSC')return'distance';if(code==='10000m')return'tenk';if(code==='Decathlon'||code==='Heptathlon')return'combined';return'standard';}
  function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/hurdles?/g,'h').replace(/steeplechase/g,'sc').replace(/[^a-z0-9]+/g,'');}
  const aliases={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon'],Heptathlon:['heptathlon']};
  // norm() collapses "Hurdles"/"Steeplechase" down to a bare trailing "h"/"sc" with no
  // separator, so "100 Metres Hurdles" normalizes to "100mh" - which STARTS WITH "100m", the
  // plain 100m alias. Without the suffix check below, a 100 m Hurdles (or 400 m Hurdles) result
  // would silently count as a flat 100m/400m result too - exactly the "wrong data" this app
  // treats as worse than showing nothing, so a startsWith match is only accepted when what's
  // left over isn't itself a real different discipline's own marker.
  function exactMatch(discipline,code){const n=norm(discipline);return (aliases[code]||[]).some(a=>{if(n===a)return true;if(!n.startsWith(a))return false;const rest=n.slice(a.length);return rest!=='h'&&rest!=='sc';});}
  // Confirmed via a live raw-data dump: WA's actual data reports a man's indoor combined event
  // as plain "Heptathlon" (no "Short Track" suffix at all, despite that being the label WA's own
  // website displays it under) - requiring that suffix here silently dropped a real, legal
  // 5788pt result. The suffix check was solving a non-problem anyway: `code` already reflects
  // the athlete's sex (this app always codes men as 'Decathlon', women as 'Heptathlon',
  // regardless of season - see target-score.js's ensureCombinedEvent), so a man's result plainly
  // called "Heptathlon" can only mean his indoor event, and a woman's "Pentathlon" can only mean
  // hers - no further disambiguation needed.
  function combinedType(discipline,code){const n=norm(discipline);if(code==='Decathlon'){if(n.startsWith('decathlon'))return'main';if(n.startsWith('heptathlon'))return'similar';}if(code==='Heptathlon'){if(n.startsWith('heptathlon'))return'main';if(n.startsWith('pentathlon'))return'similar';}return null;}
  function validDate(r,code){const raw=r?.date;if(!raw)return false;const d=new Date(raw);if(Number.isNaN(d.getTime()))return false;const cutoff=new Date();if(group(code)==='combined'||group(code)==='tenk')cutoff.setUTCMonth(cutoff.getUTCMonth()-18);else cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);return d>=cutoff;}
  async function ensureScoring(){if(scoringData)return scoringData;try{const res=await fetch(SCORING_URL,{cache:'force-cache'});if(res.ok)scoringData=await res.json();}catch(_){}return scoringData;}
  function parseMark(raw,unit){const s=String(raw??'').trim().replace(',','.');if(!s)return NaN;if(unit==='seconds'&&s.includes(':')){const p=s.split(':').map(Number);if(p.some(v=>!Number.isFinite(v)))return NaN;if(p.length===2)return p[0]*60+p[1];if(p.length===3)return p[0]*3600+p[1]*60+p[2];}return Number(s.replace(/[^0-9.+-]/g,''));}
  function scoreFromTable(code,mark){const evt=scoringData?.[sex.value]?.[code];if(!evt)return null;const perf=parseMark(mark,evt.unit);if(!Number.isFinite(perf))return null;for(const [pts,tableMark] of evt.data){if(evt.direction==='min'&&tableMark>=perf)return pts;if(evt.direction==='max'&&tableMark<=perf)return pts;}return null;}
  function candidate(r,code){const g=group(code),type=g==='combined'?combinedType(r.discipline,code):(exactMatch(r.discipline,code)?'main':null);if(!type||r.legal===false||!validDate(r,code))return null;let rs=Number(r.resultScore);if((!Number.isFinite(rs)||rs<=0)&&g!=='combined')rs=scoreFromTable(code,r.mark);const place=Number(r.place),cat=String(r.category||'').toUpperCase();const ps=placingTables[g]?.[cat]?.[place-1];if(!Number.isFinite(rs)||rs<=0||!Number.isFinite(place)||ps==null)return null;return {...r,type,resultScore:rs,placingScore:ps,score:rs+ps};}
  function basisFor(code){const needed=req[group(code)];const candidates=allResults.map(r=>candidate(r,code)).filter(Boolean).sort((a,b)=>b.score-a.score);if(group(code)==='combined'){const validPairs=[];for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){const pair=[candidates[i],candidates[j]];if(pair.some(x=>x.type==='main'))validPairs.push(pair);}if(!validPairs.length)return {selected:candidates.slice(0,needed),candidates,needed,complete:false};validPairs.sort((a,b)=>(b[0].score+b[1].score)-(a[0].score+a[1].score));const selected=validPairs[0].sort((a,b)=>b.score-a.score);return {selected,candidates,needed,complete:true,rankingScore:Math.floor(selected.reduce((s,x)=>s+x.score,0)/needed)};}const selected=candidates.slice(0,needed);return {selected,candidates,needed,complete:selected.length>=needed,rankingScore:selected.length>=needed?Math.floor(selected.reduce((s,x)=>s+x.score,0)/needed):null};}
  function fillScores(basis){setTimeout(()=>{const scores=[...document.querySelectorAll('.existingScore')],types=[...document.querySelectorAll('.existingType')];if(!scores.length)return;scores.forEach(el=>el.value='');types.forEach(el=>el.value='main');basis.selected.slice(0,scores.length).forEach((x,i)=>{scores[i].value=String(x.score);if(types[i])types[i].value=x.type;});scores.forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));},140);}
  function rowHtml(x){const badge=x.type==='similar'?'<span class="event-type-badge event-type-similar">Similar Event</span>':'<span class="event-type-badge event-type-main">Main Event</span>';const sub=x.source==='combined-event-subevent'?'<span class="subevent-note">fra mangekamp</span>':'';const meta=[x.date,x.competition].filter(Boolean).join(' · ');return `${x.mark??''} ${x.discipline} · ${x.resultScore} Result Score + ${x.placingScore} Placing Score = <strong>${x.score} Performance Score</strong>${badge}${sub}${meta?`<div class="basis-note">${meta}</div>`:''}`;}

  function exposeBasis(basis){
    window.__rankingstevnerReconstructedBasis={
      event:eventSelect.value,
      rankingScore:Number.isFinite(basis.rankingScore)?basis.rankingScore:null,
      needed:basis.needed,
      complete:!!basis.complete,
      selected:basis.selected.map(x=>({
        date:x.date||null,
        competition:x.competition||null,
        result:x.mark??null,
        discipline:x.discipline||null,
        resultScore:Number(x.resultScore),
        placingScore:Number(x.placingScore),
        performanceScore:Number(x.score),
        type:x.type||'main',
        source:x.source||null
      })),
      // Every legal scored result, not just the top `needed` selected for the ranking score
      // itself - "Historisk nivå" needs the athlete's best mark in ONE specific discipline
      // (e.g. indoor Heptathlon), which is often not among the top 2 overall if the athlete's
      // other discipline (e.g. outdoor Decathlon) scores higher - that mark still exists and is
      // still legal, it just isn't part of *this* athlete's combined ranking basis.
      candidates:(basis.candidates||[]).map(x=>({
        date:x.date||null,
        competition:x.competition||null,
        result:x.mark??null,
        discipline:x.discipline||null,
        type:x.type||'main'
      }))
    };
    window.dispatchEvent(new CustomEvent('rankingbasisupdated'));
  }

  function renderBasis(basis){
    exposeBasis(basis);
    if(!waDetails)return;
    const official=window.__rankingstevnerOfficialRanking;
    const sameOfficial=official&&official.event===eventSelect.value&&Number(official.score)>0;
    const old=document.getElementById('autoRankingBasisAllEvents');if(old)old.remove();
    // official-ranking.js already renders the full Ranking Score card and basis table straight
    // from WA data once a verified ranking is found - showing the locally reconstructed version
    // too would just duplicate the same box right above it.
    if(sameOfficial){waDetails.style.display='none';return;}
    const box=document.createElement('div');box.id='autoRankingBasisAllEvents';
    const label=eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;
    let leftHtml='';
    if(!basis.selected.length){
      leftHtml=`<strong>Automatisk rankinggrunnlag for ${label}:</strong><br><span class="muted">Ingen gyldige WA-resultater funnet innenfor gjeldende rankingperiode.</span>`;
    }else{
      const rows=basis.selected.map(rowHtml).join('<br><br>');
      const status=basis.complete?'':`<br><span class="muted">Fant ${basis.selected.length} av ${basis.needed} nødvendige tellende resultater innenfor rankingperioden. Ingen gyldig Ranking Score ennå.</span>`;
      leftHtml=`<strong>Automatisk rankinggrunnlag for ${label}:</strong><br>${rows}${status}`;
    }
    let rightHtml='';
    if(basis.complete){rightHtml=`<div class="ranking-score-card"><div class="ranking-score-label">BEREGNET RANKING SCORE</div><div class="ranking-score-value">${basis.rankingScore}</div><div class="ranking-score-note">Midlertidig beregning. Ingen offisiell WA Ranking Score funnet.</div></div>`;}
    box.innerHTML=`<div class="ranking-basis-left">${leftHtml}</div>${rightHtml}`;waDetails.appendChild(box);waDetails.style.display='block';
  }
  // "Historisk nivå" only needs the athlete's best raw mark in a given discipline (indoor
  // Heptathlon vs outdoor Decathlon etc.) - not a reconstructed WA ranking score. Reusing
  // candidate()/basisFor() for that turned out wrong: a live diagnostics dump showed a real,
  // legal indoor Heptathlon Short Track result (5788pts, confirmed via the athlete's own WA
  // seasons-best page) never appearing among the exposed candidates at all, because candidate()
  // additionally requires resolving a WA Result Score + a placingTables[category][place-1]
  // lookup to succeed - machinery this app needs for the ranking-score box above, but that has
  // nothing to do with "what did they score in this discipline". A result missing/failing either
  // of those got silently dropped regardless of being a perfectly valid mark. This exposes
  // discipline-matched raw results directly - only legal + date-valid + discipline classified,
  // no ranking-score reconstruction required.
  // "Historisk nivå" needs the athlete's best raw mark in the currently selected øvelse -
  // for Decathlon/Heptathlon that means classifying each result as the meet's own discipline
  // ('main') vs. its indoor/outdoor counterpart ('similar', see combinedType above); for every
  // other øvelse there's only one type ('main') since e.g. Long Jump has no such sub-discipline
  // split - exactMatch() (already used by candidate() above for the ranking-score
  // reconstruction) does that name matching without duplicating a second scheme.
  function exposeRawCombinedResults(){
    const code=eventSelect.value;
    if(!code){window.__rankingstevnerOwnResults=null;renderRawDebug([],code,false);return;}
    const combined=code==='Decathlon'||code==='Heptathlon';
    if(!combined){
      // Every one of the athlete's logged results, unfiltered - unlike combined events there's
      // no cheap "mentions this event" text filter that generalizes across 19 different
      // individual codes, so this shows the full list instead. Same reasoning as the combined-
      // events debug table below: "why is X my best 100m mark" needs to see every candidate
      // result and exactly which of the three gates (legal/date/discipline match) it passed or
      // failed, not just the ones that already made it through.
      renderRawDebug(allResults,code,false);
      const rows=allResults
        .filter(r=>r.legal!==false&&validDate(r,code)&&exactMatch(r.discipline,code))
        .map(r=>({date:r.date||null,competition:r.competition||null,discipline:r.discipline||null,mark:r.mark??null,type:'main'}));
      window.__rankingstevnerOwnResults={event:code,rows};
      return;
    }
    // Every result whose discipline text even mentions decathlon/heptathlon/pentathlon,
    // completely unfiltered by legal/date/type - three straight fixes to the filtered version
    // below all still came up short on live data, so this shows which of the three gates (or
    // whether the result is even present in allResults at all) is actually the blocker, visibly
    // in the page instead of needing a separate raw-JSON fetch.
    const allCombinedMentions=allResults.filter(r=>/decathlon|heptathlon|pentathlon/i.test(String(r.discipline||'')));
    renderRawDebug(allCombinedMentions,code,true);
    const rows=allResults
      .filter(r=>r.legal!==false&&validDate(r,code)&&combinedType(r.discipline,code))
      .map(r=>({date:r.date||null,competition:r.competition||null,discipline:r.discipline||null,mark:r.mark??null,type:combinedType(r.discipline,code)}));
    window.__rankingstevnerOwnResults={event:code,rows};
  }
  function renderRawDebug(entries,code,isCombined){
    if(!waDetails||!waDetails.parentNode)return;
    const old=document.getElementById('rawCombinedDebugBox');if(old)old.remove();
    if(!code)return;
    const box=document.createElement('details');
    box.id='rawCombinedDebugBox';
    box.style.cssText='margin-top:10px;font-size:11px;color:#677585';
    const cell='style="border:1px solid #d8e0e6;padding:3px 6px"';
    const rows=entries.map(r=>{
      const legalOk=r.legal!==false;
      const dateOk=validDate(r,code);
      const typeVal=isCombined?combinedType(r.discipline,code):(exactMatch(r.discipline,code)?'main':null);
      return `<tr><td ${cell}>${r.discipline||''}</td><td ${cell}>${r.mark??''}</td><td ${cell}>${r.date||''}</td><td ${cell}>${legalOk?'ja':'NEI'}</td><td ${cell}>${dateOk?'ja':'NEI'}</td><td ${cell}>${typeVal||'ingen'}</td></tr>`;
    }).join('');
    const title=isCombined?`Rådata: mangekamp-relaterte resultater (${entries.length})`:`Rådata: alle registrerte resultater (${entries.length})`;
    const emptyMsg=isCombined?'Ingen resultater i rådataene nevner decathlon/heptathlon/pentathlon i det hele tatt.':'Ingen resultater funnet for denne utøveren.';
    box.innerHTML=`<summary style="cursor:pointer">${title}</summary>`+
      (entries.length
        ? `<table style="margin-top:6px;border-collapse:collapse;width:100%"><tr style="font-weight:700"><td ${cell}>Øvelse</td><td ${cell}>Mark</td><td ${cell}>Dato</td><td ${cell}>Lovlig</td><td ${cell}>Innenfor periode</td><td ${cell}>Klassifisert som</td></tr>${rows}</table>`
        : `<div style="margin-top:6px">${emptyMsg}</div>`);
    // Appended as a SIBLING right after waDetails, not a child inside it - waDetails itself gets
    // set to display:none whenever official-ranking.js already shows a matching official WA
    // ranking box (to avoid a duplicate), which would have hidden this debug box along with it.
    waDetails.insertAdjacentElement('afterend',box);
  }
  function refresh(){exposeRawCombinedResults();if(!allResults.length){window.__rankingstevnerReconstructedBasis={event:eventSelect.value,selected:[],needed:req[group(eventSelect.value)],complete:false,rankingScore:null};window.dispatchEvent(new CustomEvent('rankingbasisupdated'));return;}const b=basisFor(eventSelect.value);fillScores(b);setTimeout(()=>renderBasis(b),180);}
  async function load(id){if(!id||loading)return;if(id===currentId&&allResults.length){await ensureScoring();refresh();return;}loading=true;try{const [res]=await Promise.all([fetch(`/api/wa-results?id=${encodeURIComponent(id)}&v=213`,{cache:'no-store'}),ensureScoring()]);const data=await res.json();if(data?.ok&&Array.isArray(data.results)){currentId=String(id);allResults=data.results;refresh();}}catch(_){}finally{loading=false;}}
  function idFromInput(){return waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';}
  eventSelect.addEventListener('change',()=>setTimeout(refresh,220));sex.addEventListener('change',()=>setTimeout(refresh,260));waInput.addEventListener('change',()=>load(idFromInput()));if(waStatus){new MutationObserver(()=>{const id=idFromInput();if(id)setTimeout(()=>load(id),50);}).observe(waStatus,{childList:true,subtree:true,characterData:true});}window.addEventListener('rankingofficialloaded',()=>setTimeout(refresh,40));const initial=idFromInput();if(initial)setTimeout(()=>load(initial),400);
})();

(function(){function hideDuplicateScoreEditor(){const scoreInputs=document.getElementById('scoreInputs');const block=scoreInputs?.closest('.existing');if(block)block.style.display='none';}hideDuplicateScoreEditor();setTimeout(hideDuplicateScoreEditor,300);})();