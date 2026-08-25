// Rankingstevner v0.19.4 – offisiell WA Ranking Score er fasit
(function(){
  'use strict';

  const STORAGE_KEY='rankingstevner.profile.v1';
  const eventSelect=document.getElementById('event');
  const waInput=document.getElementById('waProfileId');
  const waStatus=document.getElementById('waProfileStatus');
  const waDetails=document.getElementById('waProfileDetails');
  if(!eventSelect||!waInput||!waDetails)return;

  let currentId='';
  let official=[];
  let loading=false;

  function norm(s){
    return String(s||'').toLowerCase()
      .replace(/metres?|meters?/g,'m')
      .replace(/women'?s|woman'?s|men'?s/g,'')
      .replace(/short track/g,'sh')
      .replace(/[^a-z0-9]+/g,'');
  }

  const selectedAliases={
    '100m':['100m'], '200m':['200m'], '400m':['400m'], '800m':['800m'], '1500m':['1500m'],
    '5000m':['5000m'], '10000m':['10000m'], '100mH':['100mh'], '110mH':['110mh'], '400mH':['400mh'],
    '3000mSC':['3000msteeplechase','3000msc'], HJ:['highjump'], PV:['polevault'], LJ:['longjump'], TJ:['triplejump'],
    SP:['shotput'], DT:['discusthrow'], HT:['hammerthrow'], JT:['javelinthrow'],
    Decathlon:['decathlon'], Heptathlon:['heptathlon']
  };

  function eventMatches(item){
    const aliases=selectedAliases[eventSelect.value]||[norm(eventSelect.value)];
    const n=norm(item?.event);
    return aliases.some(a=>n===a||n.startsWith(a));
  }

  function getOfficial(){
    return official.find(eventMatches)||null;
  }

  function patch(){
    const hit=getOfficial();
    if(!hit||!Number.isFinite(Number(hit.score)))return;
    const score=Number(hit.score);
    const rank=Number(hit.rank);
    const label=eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;

    // Øverste linje: alltid WA sin offisielle plassering og score når den finnes.
    const first=waDetails.firstElementChild;
    if(first && !first.id){
      const eventName=hit.event||label;
      first.innerHTML=`<strong>Rankinggrunnlag for ${label}:</strong><br>${Number.isFinite(rank)?`#${rank} ${eventName} · `:''}<strong>${score} Ranking Score</strong>`;
    }

    // Den store scoreboksen skal aldri overstyres av vår rekonstruksjon når WA har fasiten.
    const auto=document.getElementById('autoRankingBasisAllEvents');
    if(auto){
      const left=auto.querySelector('.ranking-basis-left');
      const card=auto.querySelector('.ranking-score-card');
      if(left){
        left.innerHTML=`<strong>Offisielt rankinggrunnlag for ${label}:</strong><br><span class="muted">Ranking Score og plassering hentes direkte fra World Athletics. Lokalt beregnede historiske resultater brukes kun internt når du simulerer en ny prestasjon.</span>`;
      }
      if(card){
        const cardLabel=card.querySelector('.ranking-score-label');
        const value=card.querySelector('.ranking-score-value');
        const note=card.querySelector('.ranking-score-note');
        if(cardLabel)cardLabel.textContent='OFFISIELL WA RANKING SCORE';
        if(value)value.textContent=String(score);
        if(note)note.textContent='Hentet direkte fra World Athletics.';
      }
    }

    window.__rankingstevnerOfficialRanking={event:eventSelect.value,score,rank:Number.isFinite(rank)?rank:null,source:'World Athletics'};
  }

  async function load(){
    const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
    if(!id||loading)return;
    if(id===currentId&&official.length){patch();return;}
    loading=true;
    try{
      const res=await fetch(`/api/athlete?id=${encodeURIComponent(id)}&official=1&v=194`,{cache:'no-store'});
      const data=await res.json();
      if(data?.ok&&Array.isArray(data.rankingScores)){
        currentId=id;
        official=data.rankingScores.filter(x=>Number.isFinite(Number(x?.score)));
        try{
          const store=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};
          store.officialRankingScores=official;
          localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
        }catch(_){ }
        patch();
      }
    }catch(_){
      // Hvis WA sin offisielle score ikke kan hentes, lar vi eksisterende visning stå.
    }finally{loading=false;}
  }

  eventSelect.addEventListener('change',()=>setTimeout(patch,260));
  waInput.addEventListener('change',()=>setTimeout(load,30));

  if(waStatus){
    new MutationObserver(()=>{
      const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
      if(id)setTimeout(load,80);
    }).observe(waStatus,{childList:true,subtree:true,characterData:true});
  }

  new MutationObserver(()=>setTimeout(patch,0)).observe(waDetails,{childList:true,subtree:true,characterData:true});
  setTimeout(load,500);
})();
