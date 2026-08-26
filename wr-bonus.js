// World Athletics Combined Events 2026 – World Record bonus.
// Existing WR bonuses come from WA result record flags; simulated Main Event WRs are handled here.
(() => {
  'use strict';

  let existingBonus = 0;
  let lastId = '';

  const $ = id => document.getElementById(id);

  async function loadExistingBonus(){
    const raw=String($('waProfileId')?.value||'');
    const id=raw.match(/(\d{7,9})/)?.[1];
    if(!id) { existingBonus=0; lastId=''; return; }
    if(id===lastId) return;
    lastId=id;
    try{
      const res=await fetch(`/api/wa-results?id=${encodeURIComponent(id)}&v=202`,{cache:'no-store'});
      const data=await res.json();
      existingBonus=Number.isFinite(Number(data?.worldRecordBonus))?Number(data.worldRecordBonus):0;
      window.__WA2026_COMBINED_WR_BONUS__={existing:existingBonus,performances:data?.worldRecordPerformances||[]};
    }catch(_){ existingBonus=0; }
  }

  function simulatedWrBonus(){
    const event=$('event')?.value;
    const wind=$('combinedWindStatus')?.value;
    if((event!=='Decathlon'&&event!=='Heptathlon') || wind!=='normal') return 0;
    const raw=String($('mark')?.value||$('resultEntryFallback')?.value||'').trim().replace(',','.');
    const mark=Number(raw);
    if(!Number.isFinite(mark)) return 0;
    const wr=event==='Decathlon'?9126:7291;
    if(mark>wr) return 20;   // New WR, Main Event
    if(mark===wr) return 10; // Equal WR, Main Event
    return 0;
  }

  function parseScoreText(el){
    const m=String(el?.textContent||'').match(/(-?\d+(?:[.,]\d+)?)/g);
    if(!m?.length) return null;
    const n=Number(m[m.length-1].replace(',','.'));
    return Number.isFinite(n)?n:null;
  }

  function applyBonus(){
    const event=$('event')?.value;
    if(event!=='Decathlon'&&event!=='Heptathlon') return;
    const currentLine=$('currentRankingLine');
    const newOut=$('newRankingOut');
    const imp=$('improvement');
    if(!currentLine||!newOut||!imp||$('resultBox')?.classList.contains('hidden')) return;

    const currentBase=parseScoreText(currentLine);
    const newBase=parseScoreText(newOut);
    if(currentBase==null||newBase==null) return;

    const newWr=simulatedWrBonus();
    const currentRank=currentBase+existingBonus;
    const newRank=newBase+existingBonus+newWr;
    const improvement=newRank-currentRank;

    currentLine.textContent=`Nåværende Ranking Score: ${currentRank}${existingBonus?` (inkl. +${existingBonus} WR-bonus)`:''}`;
    newOut.textContent=String(newRank);
    imp.className='improvement '+(improvement>0?'good':improvement<0?'bad':'');
    imp.textContent=improvement>0?`+${improvement} rankingpoeng`:improvement===0?'Ingen endring i rankingpoeng':`${improvement} rankingpoeng`;

    const rule=$('ruleInfo');
    if(rule){
      const parts=[];
      if(existingBonus) parts.push(`Eksisterende WR-bonus: +${existingBonus}.`);
      if(newWr) parts.push(`Ny prestasjon gir WR-bonus: +${newWr}.`);
      if(parts.length && !rule.textContent.includes('WR-bonus')) rule.textContent=`${rule.textContent} ${parts.join(' ')}`.trim();
    }
  }

  $('loadWaProfile')?.addEventListener('click',()=>setTimeout(loadExistingBonus,50));
  $('profileName')?.addEventListener('change',()=>setTimeout(loadExistingBonus,250));
  $('clearProfile')?.addEventListener('click',()=>{existingBonus=0;lastId='';});
  $('calculate')?.addEventListener('click',()=>{setTimeout(applyBonus,0);setTimeout(applyBonus,120);});
  setTimeout(loadExistingBonus,700);
})();
