// Shared helpers only. Trinn 3 UI/logikk ligger nå kun i trinn3.js.
(function(){
  function loadSearch(){
    if(document.querySelector('script[data-ranking-search-v090]'))return;
    const s=document.createElement('script');
    s.src='athlete-search-ui.js?v=090';
    s.dataset.rankingSearchV090='1';
    document.head.appendChild(s);
  }
  setTimeout(loadSearch,0);
})();

(function(){
  function loadBasis(){
    if(document.querySelector('script[data-ranking-basis-v095]'))return;
    const s=document.createElement('script');
    s.src='ranking-basis.js?v=095';
    s.dataset.rankingBasisV095='1';
    document.head.appendChild(s);
  }
  setTimeout(loadBasis,0);
})();

(function(){
  function loadLayout(){
    if(document.querySelector('script[data-ranking-layout-v016]'))return;
    const s=document.createElement('script');
    s.src='layout-v016.js?v=0160';
    s.dataset.rankingLayoutV016='1';
    document.head.appendChild(s);
  }
  setTimeout(loadLayout,0);
})();

(function(){
  function loadCombinedFix(){
    if(document.querySelector('script[data-combined-ranking-fix-v0163]'))return;
    const s=document.createElement('script');
    s.src='combined-ranking-fix.js?v=0163';
    s.dataset.combinedRankingFixV0163='1';
    document.head.appendChild(s);
  }
  setTimeout(loadCombinedFix,0);
})();

(function(){
  const eventSelect=document.getElementById('event');
  const sex=document.getElementById('sex');
  if(!eventSelect||!sex)return;
  function ensureCombinedEvent(){
    const code=sex.value==='W'?'Heptathlon':'Decathlon';
    const label=sex.value==='W'?'Sjukamp':'Tikamp';
    const other=sex.value==='W'?'Decathlon':'Heptathlon';
    const oldOther=eventSelect.querySelector(`option[value="${other}"]`);
    if(oldOther)oldOther.remove();
    if(!eventSelect.querySelector(`option[value="${code}"]`)){
      const opt=document.createElement('option');
      opt.value=code;
      opt.textContent=label;
      eventSelect.appendChild(opt);
    }
  }
  setTimeout(ensureCombinedEvent,700);
  sex.addEventListener('change',()=>setTimeout(ensureCombinedEvent,80));
})();

(function(){
  function removeDuplicateCombinedBox(){
    document.querySelectorAll('#waProfileDetails div').forEach(el=>{
      const strong=el.querySelector(':scope > strong');
      if(strong && strong.textContent.trim().startsWith('Tellende Performance Scores:')) el.remove();
    });
  }
  const details=document.getElementById('waProfileDetails');
  if(details)new MutationObserver(removeDuplicateCombinedBox).observe(details,{childList:true,subtree:true});
  setTimeout(removeDuplicateCombinedBox,200);
})();
