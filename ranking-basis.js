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
  function exactMatch(discipline,code){const n=norm(discipline);return (aliases[code]||[]).some(a=>n===a||n.startsWith(a));}
  function combinedType(discipline,code){const n=norm(discipline);if(code==='Decathlon'){if(n.startsWith('decathlon'))return'main';if(n.includes('heptathlon')&&(n.includes('shorttrack')||n.endsWith('sh')))return'similar';}if(code==='Heptathlon'){if(n.startsWith('heptathlon')&&!n.includes('shorttrack')&&!n.endsWith('sh'))return'main';if(n.includes('pentathlon')&&(n.includes('shorttrack')||n.endsWith('sh')||n==='pentathlon'))return'similar';}return null;}
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
    const box=document.createElement('div');box.id='autoRankingBasisAllEvents';
    const label=eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;
    let leftHtml='';
    if(sameOfficial){
      const rows=basis.selected.length?basis.selected.map(rowHtml).join('<br><br>'):'<span class="muted">Fant ikke nok resultatdetaljer til å rekonstruere grunnlaget.</span>';
      const calc=basis.complete&&Number.isFinite(basis.rankingScore)?`<div class="basis-note">Rekonstruert snitt fra disse resultatene: <strong>${basis.rankingScore}</strong>. Offisiell WA Ranking Score er <strong>${Number(official.score)}</strong> og er fasit.</div>`:'';
      leftHtml=`<strong>Rankinggrunnlag for ${label}:</strong><br>${rows}${calc}<div class="basis-note">Resultatene er hentet fra WA-resultatdata og koblet mot WA-tabellene for Result Score og Placing Score. Den publiserte WA Ranking Score overstyrer alltid denne rekonstruksjonen.</div>`;
    }else if(!basis.selected.length){
      leftHtml=`<strong>Automatisk rankinggrunnlag for ${label}:</strong><br><span class="muted">Ingen gyldige WA-resultater funnet innenfor gjeldende rankingperiode.</span>`;
    }else{
      const rows=basis.selected.map(rowHtml).join('<br><br>');
      const status=basis.complete?'':`<br><span class="muted">Fant ${basis.selected.length} av ${basis.needed} nødvendige tellende resultater innenfor rankingperioden. Ingen gyldig Ranking Score ennå.</span>`;
      leftHtml=`<strong>Automatisk rankinggrunnlag for ${label}:</strong><br>${rows}${status}`;
    }
    let rightHtml='';
    if(sameOfficial){rightHtml=`<div class="ranking-score-card"><div class="ranking-score-label">OFFISIELL WA RANKING SCORE</div><div class="ranking-score-value">${Number(official.score)}</div><div class="ranking-score-note">Verifisert mot World Athletics.</div></div>`;}
    else if(basis.complete){rightHtml=`<div class="ranking-score-card"><div class="ranking-score-label">BEREGNET RANKING SCORE</div><div class="ranking-score-value">${basis.rankingScore}</div><div class="ranking-score-note">Midlertidig beregning. Ingen offisiell WA Ranking Score funnet.</div></div>`;}
    box.innerHTML=`<div class="ranking-basis-left">${leftHtml}</div>${rightHtml}`;waDetails.appendChild(box);waDetails.style.display='block';
  }
  function refresh(){if(!allResults.length){window.__rankingstevnerReconstructedBasis={event:eventSelect.value,selected:[],needed:req[group(eventSelect.value)],complete:false,rankingScore:null};window.dispatchEvent(new CustomEvent('rankingbasisupdated'));return;}const b=basisFor(eventSelect.value);fillScores(b);setTimeout(()=>renderBasis(b),180);}
  async function load(id){if(!id||loading)return;if(id===currentId&&allResults.length){await ensureScoring();refresh();return;}loading=true;try{const [res]=await Promise.all([fetch(`/api/wa-results?id=${encodeURIComponent(id)}&v=213`,{cache:'no-store'}),ensureScoring()]);const data=await res.json();if(data?.ok&&Array.isArray(data.results)){currentId=String(id);allResults=data.results;refresh();}}catch(_){}finally{loading=false;}}
  function idFromInput(){return waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';}
  eventSelect.addEventListener('change',()=>setTimeout(refresh,220));sex.addEventListener('change',()=>setTimeout(refresh,260));waInput.addEventListener('change',()=>load(idFromInput()));if(waStatus){new MutationObserver(()=>{const id=idFromInput();if(id)setTimeout(()=>load(id),50);}).observe(waStatus,{childList:true,subtree:true,characterData:true});}window.addEventListener('rankingofficialloaded',()=>setTimeout(refresh,40));const initial=idFromInput();if(initial)setTimeout(()=>load(initial),400);
})();

(function(){function hideDuplicateScoreEditor(){const scoreInputs=document.getElementById('scoreInputs');const block=scoreInputs?.closest('.existing');if(block)block.style.display='none';}hideDuplicateScoreEditor();setTimeout(hideDuplicateScoreEditor,300);})();