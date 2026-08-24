// Rankingstevner v0.9.4 – ryddigere Trinn 3 og trygg resultatregistrering
(function(){
  const mark=document.getElementById('mark');
  const resultScore=document.getElementById('resultScore');
  const eventSelect=document.getElementById('event');
  const category=document.getElementById('category');
  const placing=document.getElementById('placing');
  const eventGroupLabel=document.getElementById('eventGroupLabel');
  const newEventType=document.getElementById('newEventType');
  const windSection=document.getElementById('windSection');
  const wind=document.getElementById('wind');
  const windAdjustment=document.getElementById('windAdjustment');
  if(!mark||!resultScore||!eventSelect||!category||!placing)return;

  const placingTables={
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };
  function group(code){if(code==='5000m'||code==='3000mSC')return'distance';if(code==='10000m')return'tenk';if(code==='Decathlon'||code==='Heptathlon')return'combined';return'standard';}

  const originalGrid=mark.closest('.grid');
  const secondGrid=category.closest('.grid');
  if(!originalGrid||!secondGrid)return;

  const wrap=document.createElement('div');
  wrap.id='trinn3Compact';
  wrap.style.cssText='display:grid;gap:16px;margin-top:8px';
  wrap.innerHTML=`
    <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(170px,.55fr);gap:14px;align-items:end">
      <div>
        <label style="display:block;font-weight:700;margin-bottom:6px">Resultat</label>
        <div id="safeResultEditor" style="display:flex;gap:8px;align-items:center"></div>
        <small id="safeResultHint" class="muted" style="display:block;margin-top:6px"></small>
      </div>
      <label style="margin:0">Result Score
        <input id="resultScoreMirror" type="text" readonly style="font-size:1.05rem;font-weight:800;background:#f7fbfa" />
        <small>Beregnes automatisk.</small>
      </label>
    </div>
    <div style="display:grid;grid-template-columns:minmax(180px,.7fr) minmax(180px,.7fr) minmax(170px,.55fr);gap:14px;align-items:end">
      <div id="categorySlot"></div>
      <div id="placingSlot"></div>
      <div style="border:1px solid #cfe2dc;border-radius:12px;background:#f7fbfa;padding:12px 14px">
        <span class="muted" style="font-size:12px">Placing Score</span>
        <strong id="placingScorePreview" style="display:block;font-size:1.8rem;line-height:1.1;margin-top:4px">–</strong>
      </div>
    </div>
    <div id="windCompact" style="display:none;grid-template-columns:minmax(180px,.7fr) minmax(170px,.55fr);gap:14px;align-items:end"></div>
  `;
  originalGrid.parentNode.insertBefore(wrap,originalGrid);

  // Flytt eksisterende kategori/plassering så all eksisterende logikk beholdes.
  const catLabel=category.closest('label');
  const placeLabel=placing.closest('label');
  wrap.querySelector('#categorySlot').appendChild(catLabel);
  wrap.querySelector('#placingSlot').appendChild(placeLabel);

  originalGrid.style.display='none';
  secondGrid.style.display='none';
  if(eventGroupLabel?.closest('label')) eventGroupLabel.closest('label').style.display='none';
  if(newEventType?.closest('label')) newEventType.closest('label').style.display='none';

  const mirror=wrap.querySelector('#resultScoreMirror');
  const scorePreview=wrap.querySelector('#placingScorePreview');
  const editor=wrap.querySelector('#safeResultEditor');
  const hint=wrap.querySelector('#safeResultHint');
  const windCompact=wrap.querySelector('#windCompact');

  function syncMark(value){
    mark.value=value;
    mark.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>mirror.value=resultScore.value,0);
  }

  function makeNumberEditor({placeholder,step='0.01',min='0',suffix='',integer=false}){
    editor.innerHTML='';
    const input=document.createElement('input');
    input.type='number';input.min=min;input.step=step;input.placeholder=placeholder;input.inputMode=integer?'numeric':'decimal';
    input.style.cssText='max-width:260px;font-size:1.2rem;font-weight:800';
    input.addEventListener('input',()=>{
      let v=input.value;
      if(v===''){syncMark('');return;}
      if(integer)v=String(Math.max(0,Math.round(Number(v))));
      syncMark(v.replace('.',','));
    });
    editor.appendChild(input);
    if(suffix){const s=document.createElement('span');s.textContent=suffix;s.style.cssText='font-weight:800;color:#677585';editor.appendChild(s);}
    return input;
  }

  function makeTimeEditor(longRace){
    editor.innerHTML='';
    if(longRace){
      const min=document.createElement('input'),sec=document.createElement('input');
      min.type='number';min.min='0';min.max='99';min.step='1';min.placeholder='min';min.inputMode='numeric';
      sec.type='number';sec.min='0';sec.max='59.99';sec.step='0.01';sec.placeholder='sek';sec.inputMode='decimal';
      [min,sec].forEach(x=>x.style.cssText='width:120px;font-size:1.2rem;font-weight:800');
      const colon=document.createElement('strong');colon.textContent=':';colon.style.fontSize='1.3rem';
      function sync(){
        if(sec.value===''){syncMark('');return;}
        const s=Math.min(59.99,Math.max(0,Number(sec.value)||0));
        sec.value=String(s);
        syncMark(`${Math.max(0,Math.floor(Number(min.value)||0))}:${s.toFixed(2).replace('.',',')}`);
      }
      min.addEventListener('input',sync);sec.addEventListener('input',sync);
      editor.append(min,colon,sec);
    }else{
      makeNumberEditor({placeholder:'f.eks. 10,32',step:'0.01',min:'0',suffix:'sek'});
    }
  }

  function rebuildResultEditor(){
    const code=eventSelect.value;
    const longRace=['800m','1500m','5000m','10000m','3000mSC'].includes(code);
    const technical=['HJ','PV','LJ','TJ','SP','DT','HT','JT'].includes(code);
    const combined=['Decathlon','Heptathlon'].includes(code);
    if(combined){makeNumberEditor({placeholder:'f.eks. 8002',step:'1',min:'0',suffix:'poeng',integer:true});hint.textContent='Kun hele poeng kan legges inn.';}
    else if(technical){makeNumberEditor({placeholder:'f.eks. 4,50',step:'0.01',min:'0',suffix:'m'});hint.textContent='Skriv resultat i meter. Komma eller punktum fungerer.';}
    else {makeTimeEditor(longRace);hint.textContent=longRace?'Skriv minutter og sekunder i hvert sitt felt.':'Skriv tiden i sekunder med to desimaler.';}
    syncMark('');
  }

  function refreshPlacing(){
    const arr=placingTables[group(eventSelect.value)]?.[category.value]||[];
    const p=Math.max(1,Number(placing.value)||1);
    scorePreview.textContent=arr[p-1]??'–';
  }

  function refreshWind(){
    const visible=windSection&&getComputedStyle(windSection).display!=='none';
    windCompact.style.display=visible?'grid':'none';
    windCompact.innerHTML='';
    if(!visible)return;
    if(wind?.closest('label')) windCompact.appendChild(wind.closest('label'));
    if(windAdjustment?.closest('label')) windCompact.appendChild(windAdjustment.closest('label'));
    windSection.style.display='none';
  }

  const rsObserver=new MutationObserver(()=>mirror.value=resultScore.value);
  rsObserver.observe(resultScore,{attributes:true,attributeFilter:['value']});
  resultScore.addEventListener('input',()=>mirror.value=resultScore.value);
  document.addEventListener('input',e=>{if(e.target===mark)setTimeout(()=>mirror.value=resultScore.value,0);});

  eventSelect.addEventListener('change',()=>setTimeout(()=>{rebuildResultEditor();refreshPlacing();refreshWind();},80));
  category.addEventListener('change',()=>setTimeout(refreshPlacing,0));
  placing.addEventListener('change',()=>setTimeout(refreshPlacing,0));
  const windObserver=new MutationObserver(()=>setTimeout(refreshWind,0));
  if(windSection) windObserver.observe(windSection,{attributes:true,attributeFilter:['style']});

  rebuildResultEditor();refreshPlacing();setTimeout(refreshWind,120);
})();