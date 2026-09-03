// Rankingstevner Trinn 3 v0.15.1 – korrekt 2026 placing-tabell + vindtrekk for mangekamp
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  // Was its own, THIRD independent copy of this table (a fourth exists in ranking-basis.js, now
  // fixed) - stale (this file's combined values were the pre-audit 2026 draft; distance/tenk were
  // truncated to only the first 6/8 places) and, because it's declared here, unreachable by
  // wa2026-placing-audit.js's patchEngine() patch (that only reaches the bare global `placingTables`
  // app.js declares - a `const` of the same name in this file's own IIFE shadows it instead of
  // being patched). The live preview text happened to still end up correct in practice only because
  // wa2026-placing-audit.js's own DOM writes run later and overwrite whatever this file set moments
  // before - fragile, and only true for the preview, not for anything computed here. Reading the
  // shared global instead of shadowing it means this file gets the real, current, audited table -
  // both the initial correct values AND any future patch - same object as everyone else, no more
  // independent copies to go stale.
  function groupFor(code){if(code==='5000m'||code==='3000mSC')return'distance';if(code==='10000m')return'tenk';if(code==='Decathlon'||code==='Heptathlon')return'combined';return'standard';}
  function init(){
    const event=$('event'),category=$('category'),placing=$('placing'),resultScore=$('resultScore'),mark=$('mark'),wind=$('wind'),bljMark=$('bljMark'),bljWind=$('bljWind'),combinedWindStatus=$('combinedWindStatus'),resultOut=$('resultScoreMirror'),placingOut=$('placingScorePreview'),performanceOut=$('performanceScorePreview');
    if(![event,category,placing,resultScore,mark,resultOut,placingOut,performanceOut].every(Boolean)){setTimeout(init,100);return;}
    const realCategoryOptions=[...category.options].filter(o=>o.value!=='').map(o=>`<option value="${o.value}">${o.textContent}</option>`).join('');category.innerHTML='<option value="" disabled hidden>f.eks. A</option>'+realCategoryOptions;category.value='';
    function placingArray(){return placingTables[groupFor(event.value)]?.[category.value]||[];}
    function maxPlacementCount(){const tables=placingTables[groupFor(event.value)]||{};return Math.max(1,...Object.values(tables).map(a=>a.length));}
    function rebuildPlacing(reset=true){const arr=placingArray(),count=arr.length||maxPlacementCount(),previous=reset?'':placing.value;placing.innerHTML='<option value="" disabled hidden>f.eks. 1. plass</option>'+Array.from({length:count},(_,i)=>`<option value="${i+1}">${i+1}. plass</option>`).join('');placing.value=previous&&Number(previous)<=count?previous:'';update();}
    function placingScore(){if(!category.value||!placing.value)return null;return placingArray()[Number(placing.value)-1]??null;}
    function update(){
      let raw=String(resultScore.value||'').trim().replace(',','.'),rs=Number(raw),valid=raw!==''&&Number.isFinite(rs),ps=placingScore();
      // app.js may rewrite resultScore with the unadjusted combined score. Always derive the visible score from the engine here.
      if(groupFor(event.value)==='combined' && typeof adjustedResultDetails==='function'){
        try{const d=adjustedResultDetails();if(d&&Number.isFinite(Number(d.adjusted))){rs=Number(d.adjusted);valid=true;resultScore.value=String(rs);}}catch(_){}
      }
      resultOut.textContent=valid?String(Math.round(rs)):'–';placingOut.textContent=ps==null?'–':String(ps);performanceOut.textContent=valid&&ps!=null?String(Math.round(rs+ps)):'–';
      const label=resultOut.parentElement?.querySelector('span');if(label)label.textContent=groupFor(event.value)==='combined'&&combinedWindStatus&&combinedWindStatus.value!=='normal'?'Justert Result Score':'Result Score';
    }
    function updateAfterEngine(){setTimeout(update,0);setTimeout(update,25);setTimeout(update,100);setTimeout(update,350);}
    function installResetButton(){if($('resetNewPerformance'))return;const strip=document.querySelector('.score-strip');if(!strip)return;strip.style.maxWidth='1080px';strip.style.gridTemplateColumns='repeat(3,minmax(170px,1fr)) auto';const btn=document.createElement('button');btn.id='resetNewPerformance';btn.type='button';btn.className='secondary';btn.textContent='Nullstill';btn.style.cssText='align-self:stretch;min-width:112px;margin:0;padding:0 18px;border-radius:12px;font-weight:800;white-space:nowrap';strip.appendChild(btn);btn.addEventListener('click',()=>{event.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{category.value='';rebuildPlacing(true);const visibleResult=$('resultDigits')||$('resultEntryFallback');if(visibleResult)visibleResult.value='';mark.value='';resultScore.value='';if(wind)wind.value='';if(bljMark)bljMark.value='';if(bljWind)bljWind.value='';if(combinedWindStatus)combinedWindStatus.value='normal';const windAdj=$('windAdjustment');if(windAdj)windAdj.value='–';resultOut.textContent='–';placingOut.textContent='–';performanceOut.textContent='–';const resultBox=$('resultBox');if(resultBox)resultBox.classList.add('hidden');['resultScoreOut','placingScoreOut','performanceScoreOut','newRankingOut','newRankPositionOut'].forEach(id=>{const el=$(id);if(el)el.textContent='–';});['improvement','currentRankingLine','replaceInfo','ruleInfo'].forEach(id=>{const el=$(id);if(el)el.textContent='';});},50);});}
    event.addEventListener('change',()=>{category.value='';rebuildPlacing(true);updateAfterEngine();});category.addEventListener('change',()=>{rebuildPlacing(true);updateAfterEngine();});placing.addEventListener('change',update);resultScore.addEventListener('input',update);resultScore.addEventListener('change',update);mark.addEventListener('input',updateAfterEngine);mark.addEventListener('change',updateAfterEngine);[wind,bljMark,bljWind].filter(Boolean).forEach(el=>{el.addEventListener('input',updateAfterEngine);el.addEventListener('change',updateAfterEngine);});if(combinedWindStatus)combinedWindStatus.addEventListener('change',()=>{try{if(typeof refreshResultScore==='function')refreshResultScore();}catch(_){}updateAfterEngine();});
    new MutationObserver(()=>{if(event.options.length){category.value='';rebuildPlacing(true);updateAfterEngine();}}).observe(event,{childList:true});rebuildPlacing(true);installResetButton();updateAfterEngine();setTimeout(()=>{category.value='';rebuildPlacing(true);installResetButton();updateAfterEngine();},400);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();