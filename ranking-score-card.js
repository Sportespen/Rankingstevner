// Rankingstevner v0.9.2 – tydelig Ranking Score-kort i rankinggrunnlaget
(function(){
  const details=document.getElementById('waProfileDetails');
  if(!details)return;

  function enhance(){
    const basis=document.getElementById('autoRankingBasisAllEvents');
    if(!basis)return;
    const text=basis.textContent||'';
    const m=text.match(/Ranking Score:\s*(\d+(?:[.,]\d+)?)/i);

    let card=document.getElementById('rankingScoreCard');
    if(!m){
      if(card)card.remove();
      basis.style.display='block';
      return;
    }

    const score=m[1].replace('.',',');
    // Fjern den gamle Ranking Score-linjen fra venstre innhold slik at tallet kun vises én gang.
    [...basis.childNodes].forEach(node=>{
      if(node.nodeType===3 && /Ranking Score:/i.test(node.textContent||'')) node.remove();
    });
    basis.innerHTML=basis.innerHTML
      .replace(/<br>\s*<strong>Ranking Score:\s*[^<]+<\/strong>/i,'')
      .replace(/<strong>Ranking Score:\s*[^<]+<\/strong>/i,'');

    let shell=document.getElementById('rankingBasisShell');
    if(!shell){
      shell=document.createElement('div');
      shell.id='rankingBasisShell';
      shell.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:stretch;margin-top:10px';
      basis.parentNode.insertBefore(shell,basis);
      shell.appendChild(basis);
    }
    basis.style.marginTop='0';
    basis.style.height='100%';

    card=document.getElementById('rankingScoreCard');
    if(!card){
      card=document.createElement('div');
      card.id='rankingScoreCard';
      card.style.cssText='border:1px solid #21405f;border-radius:12px;background:#0b1d33;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px 14px;text-align:center;min-height:120px';
      shell.appendChild(card);
    }
    card.innerHTML=`<span style="font-size:13px;font-weight:800;color:#aebed0;margin-bottom:6px">RANKING SCORE</span><strong style="font-size:38px;line-height:1;color:#f4f7fb">${score}</strong>`;

    if(window.matchMedia('(max-width:700px)').matches){
      shell.style.gridTemplateColumns='1fr';
      card.style.minHeight='96px';
    }else{
      shell.style.gridTemplateColumns='minmax(0,1fr) 190px';
      card.style.minHeight='120px';
    }
  }

  const observer=new MutationObserver(()=>setTimeout(enhance,0));
  observer.observe(details,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',enhance);
  setTimeout(enhance,300);
})();
