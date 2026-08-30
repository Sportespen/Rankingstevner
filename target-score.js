// Shared helpers only. Trinn 3 UI/logikk ligger nå kun i trinn3.js.
(function(){function loadLayout(){if(document.querySelector('script[data-ranking-layout-v0167]'))return;const s=document.createElement('script');s.src='layout-v016.js?v=0167';s.dataset.rankingLayoutV0167='1';document.head.appendChild(s);}setTimeout(loadLayout,0);})();
(function(){function loadCombinedFix(){if(document.querySelector('script[data-combined-ranking-fix-v0163]'))return;const s=document.createElement('script');s.src='combined-ranking-fix.js?v=0163';s.dataset.combinedRankingFixV0163='1';document.head.appendChild(s);}setTimeout(loadCombinedFix,0);})();
(function(){function loadProfileUx(){if(document.querySelector('script[data-profile-ux-v0166]'))return;const s=document.createElement('script');s.src='profile-ux-v0165.js?v=0166';s.dataset.profileUxV0166='1';document.head.appendChild(s);}setTimeout(loadProfileUx,0);})();
(function(){function loadGenderReset(){if(document.querySelector('script[data-gender-reset-v0166]'))return;const s=document.createElement('script');s.src='gender-reset.js?v=0166';s.dataset.genderResetV0166='1';document.head.appendChild(s);}setTimeout(loadGenderReset,0);})();
(function(){function loadRankingBasisReset(){if(document.querySelector('script[data-ranking-basis-reset-v0168]'))return;const s=document.createElement('script');s.src='ranking-basis-reset-v0168.js?v=0168';s.dataset.rankingBasisResetV0168='1';document.head.appendChild(s);}setTimeout(loadRankingBasisReset,0);})();
(function(){const eventSelect=document.getElementById('event'),sex=document.getElementById('sex');if(!eventSelect||!sex)return;function ensureCombinedEvent(){const code=sex.value==='W'?'Heptathlon':'Decathlon',label=sex.value==='W'?'Sjukamp':'Tikamp',other=sex.value==='W'?'Decathlon':'Heptathlon';const oldOther=eventSelect.querySelector(`option[value="${other}"]`);if(oldOther)oldOther.remove();if(!eventSelect.querySelector(`option[value="${code}"]`)){const opt=document.createElement('option');opt.value=code;opt.textContent=label;eventSelect.appendChild(opt);}}setTimeout(ensureCombinedEvent,700);sex.addEventListener('change',()=>setTimeout(ensureCombinedEvent,80));})();
(function(){function removeDuplicateCombinedBox(){document.querySelectorAll('#waProfileDetails div').forEach(el=>{const strong=el.querySelector(':scope > strong');if(strong&&strong.textContent.trim().startsWith('Tellende Performance Scores:'))el.remove();});}const details=document.getElementById('waProfileDetails');if(details)new MutationObserver(removeDuplicateCombinedBox).observe(details,{childList:true,subtree:true});setTimeout(removeDuplicateCombinedBox,200);})();
// v0.20.4: synlig WA-ranking med diagnostikk dersom kilden feiler.
(function(){
  function loadOfficialRanking(){if(document.querySelector('script[data-official-ranking-v311]'))return;const s=document.createElement('script');s.src='official-ranking.js?v=311';s.dataset.officialRankingV311='1';document.head.appendChild(s);s.addEventListener('load',()=>setTimeout(loadBasis,0));}
  function loadBasis(){if(document.querySelector('script[data-ranking-basis-v220]'))return;const s=document.createElement('script');s.src='ranking-basis.js?v=220';s.dataset.rankingBasisV220='1';document.head.appendChild(s);}
  setTimeout(loadOfficialRanking,0);
})();
// v0.24.0: ekte WA-basert estimat for ny rankingplassering (worldathletics.org sin egen
// offentlige rangeringsliste, ikke EA).
(function(){
  function loadRankPosition(){if(document.querySelector('script[data-rank-position-v1]'))return;const s=document.createElement('script');s.src='ranking-position-estimate.js?v=1';s.dataset.rankPositionV1='1';document.head.appendChild(s);}
  setTimeout(loadRankPosition,0);
})();