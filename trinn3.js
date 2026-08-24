// Rankingstevner Trinn 3 v0.12.1 – scorevisning og plassering. Resultatfeltet eies av result-field.js
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const placingTables = {
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };

  function groupFor(code){
    if(code==='5000m'||code==='3000mSC') return 'distance';
    if(code==='10000m') return 'tenk';
    if(code==='Decathlon'||code==='Heptathlon') return 'combined';
    return 'standard';
  }

  function init(){
    const event=$('event'), category=$('category'), placing=$('placing'), resultScore=$('resultScore');
    const resultOut=$('resultScoreMirror'), placingOut=$('placingScorePreview'), performanceOut=$('performanceScorePreview');
    if(![event,category,placing,resultScore,resultOut,placingOut,performanceOut].every(Boolean)){
      setTimeout(init,100); return;
    }

    function placingArray(){ return placingTables[groupFor(event.value)]?.[category.value] || []; }
    function rebuildPlacing(){
      const arr=placingArray();
      placing.innerHTML=arr.map((_,i)=>`<option value="${i+1}">${i+1}. plass</option>`).join('');
      if(arr.length) placing.value='1';
      update();
    }
    function placingScore(){
      const arr=placingArray();
      const pos=Number(placing.value||0);
      return pos>0 ? (arr[pos-1] ?? null) : null;
    }
    function update(){
      const raw=String(resultScore.value||'').trim().replace(',','.');
      const rs=Number(raw), ps=placingScore();
      const valid=raw!=='' && Number.isFinite(rs);
      resultOut.textContent=valid ? String(Math.round(rs)) : '–';
      placingOut.textContent=ps==null ? '–' : String(ps);
      performanceOut.textContent=valid && ps!=null ? String(Math.round(rs+ps)) : '–';
    }

    event.addEventListener('change',rebuildPlacing);
    category.addEventListener('change',rebuildPlacing);
    placing.addEventListener('change',update);
    resultScore.addEventListener('input',update);
    resultScore.addEventListener('change',update);
    new MutationObserver(()=>{ if(event.options.length) rebuildPlacing(); }).observe(event,{childList:true});

    rebuildPlacing();
    setTimeout(rebuildPlacing,400);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
