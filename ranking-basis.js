// Rankingstevner v0.9.1 – automatisk rankinggrunnlag fra WA-resultater
(function(){
  const eventSelect=document.getElementById('event');
  const sex=document.getElementById('sex');
  const waInput=document.getElementById('waProfileId');
  const waStatus=document.getElementById('waProfileStatus');
  const waDetails=document.getElementById('waProfileDetails');
  if(!eventSelect||!sex||!waInput)return;

  const placingTables={
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };
  const req={standard:5,distance:3,tenk:2,combined:2};
  let currentId='',allResults=[],loading=false;

  function group(code){if(code==='5000m'||code==='3000mSC')return'distance';if(code==='10000m')return'tenk';if(code==='Decathlon'||code==='Heptathlon')return'combined';return'standard';}
  function norm(s){return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/hurdles?/g,'h').replace(/steeplechase/g,'sc').replace(/[^a-z0-9]+/g,'');}
  const aliases={
    '100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],
    '100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc'],
    HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],
    Decathlon:['decathlon'],Heptathlon:['heptathlon']
  };
  function exactMatch(discipline,code){const n=norm(discipline);return (aliases[code]||[]).some(a=>n===a||n.startsWith(a));}
  function combinedType(discipline,code){const n=norm(discipline);if(code==='Decathlon'){if(n.startsWith('decathlon'))return'main';if(n.includes('heptathlonshorttrack'))return'similar';}if(code==='Heptathlon'){if(n.startsWith('heptathlon')&&!n.includes('shorttrack'))return'main';if(n.includes('pentathlonshorttrack'))return'similar';}return null;}
  function candidate(r,code){
    const g=group(code),type=g==='combined'?combinedType(r.discipline,code):(exactMatch(r.discipline,code)?'main':null);
    if(!type||r.legal===false)return null;
    const rs=Number(r.resultScore),place=Number(r.place),cat=String(r.category||'').toUpperCase();
    const ps=placingTables[g]?.[cat]?.[place-1];
    if(!Number.isFinite(rs)||rs<=0||!Number.isFinite(place)||ps==null)return null;
    return {...r,type,resultScore:rs,placingScore:ps,score:rs+ps};
  }
  function basisFor(code){
    const needed=req[group(code)];
    const candidates=allResults.map(r=>candidate(r,code)).filter(Boolean).sort((a,b)=>b.score-a.score);
    if(group(code)==='combined'){
      const mains=candidates.filter(x=>x.type==='main');
      const selected=[];
      if(mains.length)selected.push(mains[0]);
      for(const x of candidates){if(selected.length>=needed)break;if(!selected.includes(x))selected.push(x);}
      if(selected.length<needed)return {selected,candidates,needed,complete:false};
      return {selected,needed,complete:true,rankingScore:Math.floor(selected.reduce((s,x)=>s+x.score,0)/needed)};
    }
    const selected=candidates.slice(0,needed);
    return {selected,candidates,needed,complete:selected.length>=needed,rankingScore:selected.length>=needed?Math.floor(selected.reduce((s,x)=>s+x.score,0)/needed):null};
  }
  function fillScores(basis){
    setTimeout(()=>{
      const scores=[...document.querySelectorAll('.existingScore')],types=[...document.querySelectorAll('.existingType')];
      if(!scores.length)return;
      scores.forEach(el=>el.value='');types.forEach(el=>el.value='main');
      basis.selected.slice(0,scores.length).forEach((x,i)=>{scores[i].value=String(x.score);if(types[i])types[i].value=x.type;});
      scores.forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));
    },140);
  }
  function renderBasis(basis){
    if(!waDetails)return;
    const old=document.getElementById('autoRankingBasisAllEvents');if(old)old.remove();
    const box=document.createElement('div');box.id='autoRankingBasisAllEvents';box.style.cssText='margin-top:10px;padding:10px;border-radius:8px;background:#eef8f5';
    const label=eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;
    if(!basis.selected.length){box.innerHTML=`<strong>Automatisk rankinggrunnlag for ${label}:</strong><br><span class="muted">Ingen gyldige WA-resultater med Result Score og Placing Score funnet i de siste tre sesongene.</span>`;}
    else{
      const rows=basis.selected.map(x=>`${x.mark??''} ${x.discipline} · ${x.resultScore} Result Score + ${x.placingScore} Placing Score = <strong>${x.score} Performance Score</strong>${x.type==='similar'?' (Similar Event)':''}`).join('<br>');
      const total=basis.complete?`<br><strong>Ranking Score: ${basis.rankingScore}</strong>`:`<br><span class="muted">Fant ${basis.selected.length} av ${basis.needed} nødvendige tellende resultater.</span>`;
      box.innerHTML=`<strong>Automatisk rankinggrunnlag for ${label}:</strong><br>${rows}${total}`;
    }
    waDetails.appendChild(box);waDetails.style.display='block';
  }
  function refresh(){if(!allResults.length)return;const b=basisFor(eventSelect.value);fillScores(b);setTimeout(()=>renderBasis(b),180);}
  async function load(id){if(!id||loading)return;if(id===currentId&&allResults.length){refresh();return;}loading=true;try{const res=await fetch(`/api/wa-results?id=${encodeURIComponent(id)}&v=091`,{cache:'no-store'});const data=await res.json();if(data?.ok&&Array.isArray(data.results)){currentId=String(id);allResults=data.results;refresh();}}catch(_){}finally{loading=false;}}
  function idFromInput(){return waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';}

  eventSelect.addEventListener('change',()=>setTimeout(refresh,220));
  sex.addEventListener('change',()=>setTimeout(refresh,260));
  waInput.addEventListener('change',()=>load(idFromInput()));
  if(waStatus){new MutationObserver(()=>{const id=idFromInput();if(id)setTimeout(()=>load(id),50);}).observe(waStatus,{childList:true,subtree:true,characterData:true});}
  const initial=idFromInput();if(initial)setTimeout(()=>load(initial),400);
})();
