// Final override for combined-event wind adjustment.
(() => {
  'use strict';

  const originalAdjusted = typeof adjustedResultDetails === 'function' ? adjustedResultDetails : null;

  try {
    adjustedResultDetails = function(){
      const event = document.getElementById('event');
      const mark = document.getElementById('mark');
      const windStatus = document.getElementById('combinedWindStatus');
      if(event && mark && (event.value === 'Decathlon' || event.value === 'Heptathlon')){
        const base = typeof lookupScoreFor === 'function' ? lookupScoreFor(event.value, mark.value) : null;
        if(base == null || !Number.isFinite(Number(base))) return null;
        const mod = windStatus && windStatus.value !== 'normal' ? -24 : 0;
        return {base:Number(base), adjusted:Number(base)+mod, windMod:mod, usedBLJ:false};
      }
      return originalAdjusted ? originalAdjusted() : null;
    };
  } catch(_) {}

  function syncCombined(){
    const event = document.getElementById('event');
    if(!event || (event.value !== 'Decathlon' && event.value !== 'Heptathlon')) return;
    const category = document.getElementById('category');
    const placing = document.getElementById('placing');
    const resultScore = document.getElementById('resultScore');
    const rsOut = document.getElementById('resultScoreMirror');
    const psOut = document.getElementById('placingScorePreview');
    const perfOut = document.getElementById('performanceScorePreview');
    const status = document.getElementById('combinedWindStatus');
    if(!category || !placing || !resultScore || !rsOut || !psOut || !perfOut) return;

    const placingTables2026={OW:[280,250,225,205,185,170,155,145,95,85,75,65,60,55,50,46],DF:[175,150,135,120,105,95,85,75,50,40,35,30],GW:[140,120,105,90,80,70,60,50,35,30,24,18],GL:[110,90,75,65,55,50,45,40,30,25,20,15],A:[80,70,60,50,45,40,35,30],B:[60,50,45,40,35,30,25,20],C:[45,38,32,26,22,19,17,15],D:[30,22,18,16,14,12,11,10],E:[20,14,10,8,7,6],F:[10,6,3]};
    const d = typeof adjustedResultDetails === 'function' ? adjustedResultDetails() : null;
    const ps = placingTables2026[category.value]?.[Number(placing.value)-1] ?? null;
    const rs = d && Number.isFinite(Number(d.adjusted)) ? Number(d.adjusted) : null;

    resultScore.value = rs == null ? '' : String(rs);
    rsOut.textContent = rs == null ? '–' : String(Math.round(rs));
    psOut.textContent = ps == null ? '–' : String(ps);
    perfOut.textContent = rs != null && ps != null ? String(Math.round(rs+ps)) : '–';
    const label = rsOut.parentElement?.querySelector('span');
    if(label) label.textContent = status && status.value !== 'normal' ? 'Justert Result Score' : 'Result Score';
  }

  const status = document.getElementById('combinedWindStatus');
  status?.addEventListener('change',()=>{syncCombined();setTimeout(syncCombined,50);setTimeout(syncCombined,250);});
  document.getElementById('mark')?.addEventListener('input',()=>setTimeout(syncCombined,0));
  document.getElementById('category')?.addEventListener('change',()=>setTimeout(syncCombined,0));
  document.getElementById('placing')?.addEventListener('change',()=>setTimeout(syncCombined,0));
  document.getElementById('event')?.addEventListener('change',()=>setTimeout(syncCombined,50));
  document.getElementById('calculate')?.addEventListener('click',()=>{setTimeout(syncCombined,0);setTimeout(syncCombined,100);});
  setTimeout(syncCombined,300);
})();