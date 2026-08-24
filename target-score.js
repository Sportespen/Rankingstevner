// Rankingstevner v0.7.5 – målscore for nytt tellende resultat
(function () {
  const placingTables = {
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };
  const reqCount = {standard:5,distance:3,tenk:2,combined:2};
  function groupForEvent(code){if(code==='5000m'||code==='3000mSC')return'distance';if(code==='10000m')return'tenk';if(code==='Decathlon'||code==='Heptathlon')return'combined';return'standard';}

  const scoreInputs = document.getElementById('scoreInputs');
  const eventSelect = document.getElementById('event');
  const category = document.getElementById('category');
  const placing = document.getElementById('placing');
  if (!scoreInputs || !eventSelect || !category || !placing) return;

  const wrap = document.createElement('div');
  wrap.id = 'targetScorePanel';
  wrap.style.cssText = 'margin:18px 0;padding:16px;border:1px solid #cfe2dc;border-radius:12px;background:#f7fbfa';
  wrap.innerHTML = `
    <div style="font-weight:800;font-size:1.05rem;margin-bottom:10px">Hva må du prestere for at resultatet skal telle?</div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
      <div style="background:#fff;border:1px solid #d9e5e1;border-radius:10px;padding:12px"><span class="muted">Svakeste tellende score</span><strong id="weakestTargetScore" style="display:block;font-size:1.5rem;margin-top:4px">–</strong></div>
      <div style="background:#fff;border:1px solid #d9e5e1;border-radius:10px;padding:12px"><span class="muted">Placing Score</span><strong id="targetPlacingScore" style="display:block;font-size:1.5rem;margin-top:4px">–</strong></div>
      <div style="background:#fff;border:1px solid #d9e5e1;border-radius:10px;padding:12px"><span class="muted">Min. Result Score</span><strong id="minimumResultScore" style="display:block;font-size:1.5rem;margin-top:4px">–</strong></div>
    </div>
    <p id="targetScoreText" class="muted" style="margin:10px 0 0">Fyll inn nåværende Performance Scores først.</p>
  `;
  scoreInputs.closest('.existing')?.insertAdjacentElement('afterend', wrap);

  const weakestOut = document.getElementById('weakestTargetScore');
  const placingOut = document.getElementById('targetPlacingScore');
  const resultOut = document.getElementById('minimumResultScore');
  const textOut = document.getElementById('targetScoreText');

  function refresh(){
    const group = groupForEvent(eventSelect.value);
    const needed = reqCount[group];
    const scores = [...document.querySelectorAll('.existingScore')].map(el=>Number(el.value)).filter(v=>Number.isFinite(v)&&v>0);
    const pos = Number(placing.value || 1);
    const ps = (placingTables[group]?.[category.value] || [])[pos-1] || 0;
    placingOut.textContent = ps;
    if(scores.length < needed){
      weakestOut.textContent = '–'; resultOut.textContent = '–';
      textOut.textContent = `Fyll inn ${needed} nåværende Performance Scores for å beregne terskelen.`;
      return;
    }
    const weakest = Math.min(...scores);
    const targetPerformance = weakest + 1;
    const minimumResult = Math.max(0, targetPerformance - ps);
    weakestOut.textContent = weakest.toFixed(1).replace('.0','').replace('.',',');
    resultOut.textContent = minimumResult.toFixed(1).replace('.0','').replace('.',',');
    textOut.innerHTML = `Med <strong>${pos}. plass</strong> i kategori <strong>${category.value}</strong> må ny Performance Score være minst <strong>${targetPerformance.toFixed(1).replace('.0','').replace('.',',')}</strong> for å slå den svakeste tellende scoren. Det tilsvarer minst <strong>${minimumResult.toFixed(1).replace('.0','').replace('.',',')}</strong> i justert Result Score. Faktisk forbedring av Ranking Score avhenger av hele gjennomsnittet og avrunding.`;
  }

  document.addEventListener('input', e=>{if(e.target.matches('.existingScore')) refresh();});
  document.addEventListener('change', e=>{if(e.target===eventSelect||e.target===category||e.target===placing||e.target.matches('.existingType')) setTimeout(refresh,0);});
  const observer = new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(scoreInputs,{childList:true,subtree:true});
  setTimeout(refresh,300);
})();

// Last den nye søkemotoren først etter at hele siden og den gamle inline-koden
// er ferdig registrert. Da kobles gammel observer fra ved å erstatte resultatnoden.
(function(){
  function loadSearch(){
    if (document.querySelector('script[data-ranking-search-v089]')) return;
    const s=document.createElement('script');
    s.src='athlete-search-ui.js?v=089';
    s.dataset.rankingSearchV089='1';
    document.head.appendChild(s);
  }
  if(document.readyState==='complete') setTimeout(loadSearch,0);
  else window.addEventListener('load',()=>setTimeout(loadSearch,0),{once:true});
})();