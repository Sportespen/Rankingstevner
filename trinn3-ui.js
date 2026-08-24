// Rankingstevner v0.9.7 – øvelsestilpasset resultatregistrering + tre scorebokser
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
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
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
    <div>
      <label style="display:block;font-weight:700;margin-bottom:6px">Resultat</label>
      <div id="safeResultEditor" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"></div>
      <small id="safeResultHint" class="muted" style="display:block;margin-top:6px"></small>
    </div>
    <div style="display:grid;grid-template-columns:minmax(180px,.7fr) minmax(180px,.7fr);gap:14px;align-items:end">
      <div id="categorySlot"></div>
      <div id="placingSlot"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(170px,1fr));gap:14px;max-width:900px">
      <div style="border:1px solid #cfe2dc;border-radius:12px;background:#f7fbfa;padding:14px 16px">
        <span class="muted" style="font-size:12px">Result Score</span>
        <strong id="resultScoreMirror" style="display:block;font-size:1.8rem;line-height:1.1;margin-top:4px">–</strong>
      </div>
      <div style="border:1px solid #cfe2dc;border-radius:12px;background:#f7fbfa;padding:14px 16px">
        <span class="muted" style="font-size:12px">Placing Score</span>
        <strong id="placingScorePreview" style="display:block;font-size:1.8rem;line-height:1.1;margin-top:4px">–</strong>
      </div>
      <div style="border:1px solid #b8d9d1;border-radius:12px;background:#eef8f5;padding:14px 16px">
        <span style="font-size:12px;font-weight:800;color:#087f5b">Performance Score</span>
        <strong id="performanceScorePreview" style="display:block;font-size:1.8rem;line-height:1.1;margin-top:4px;color:#0b4f4a">–</strong>
      </div>
    </div>
    <div id="windCompact" style="display:none;grid-template-columns:minmax(180px,.7fr) minmax(170px,.55fr);gap:14px;align-items:end"></div>
  `;
  originalGrid.parentNode.insertBefore(wrap,originalGrid);

  const catLabel=category.closest('label');
  const placeLabel=placing.closest('label');
  wrap.querySelector('#categorySlot').appendChild(catLabel);
  wrap.querySelector('#placingSlot').appendChild(placeLabel);

  originalGrid.style.display='none';
  secondGrid.style.display='none';
  if(eventGroupLabel?.closest('label'))eventGroupLabel.closest('label').style.display='none';
  if(newEventType?.closest('label'))newEventType.closest('label').style.display='none';

  const mirror=wrap.querySelector('#resultScoreMirror');
  const scorePreview=wrap.querySelector('#placingScorePreview');
  const performancePreview=wrap.querySelector('#performanceScorePreview');
  const editor=wrap.querySelector('#safeResultEditor');
  const hint=wrap.querySelector('#safeResultHint');
  const windCompact=wrap.querySelector('#windCompact');

  function currentPlacingScore(){
    const arr=placingTables[group(eventSelect.value)]?.[category.value]||[];
    const p=Math.max(1,Number(placing.value)||1);
    const ps=arr[p-1];
    return ps==null?null:Number(ps);
  }

  function refreshScores(){
    const ps=currentPlacingScore();
    const raw=String(resultScore.value||'').trim();
    const rs=Number(raw.replace(',','.'));
    mirror.textContent=Number.isFinite(rs)&&raw!==''?String(Math.round(rs)):'–';
    scorePreview.textContent=ps==null?'–':String(ps);
    performancePreview.textContent=(Number.isFinite(rs)&&raw!==''&&ps!=null)?String(Math.round(rs+ps)):'–';
  }

  function syncMark(value){
    mark.value=value;
    mark.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(refreshScores,0);
    setTimeout(refreshScores,50);
  }

  function digitField({placeholder,maxLength=2,max=null,width=92}){
    const input=document.createElement('input');
    input.type='text';input.inputMode='numeric';input.autocomplete='off';input.placeholder=placeholder;input.maxLength=maxLength;
    input.style.cssText=`width:${width}px;font-size:1.2rem;font-weight:800;text-align:center`;
    input.addEventListener('input',()=>{
      let v=input.value.replace(/\D/g,'').slice(0,maxLength);
      if(max!==null&&v!==''&&Number(v)>max)v=String(max);
      input.value=v;
    });
    return input;
  }
  function sep(text){const s=document.createElement('strong');s.textContent=text;s.style.cssText='font-size:1.25rem;color:#526170';return s;}
  function unit(text){const s=document.createElement('span');s.textContent=text;s.style.cssText='font-weight:800;color:#677585';return s;}

  function makeSprintEditor(code){
    editor.innerHTML='';
    const maxSec={100m:30,200m:60,400m:120,100mH:40,110mH:40,400mH:120}[code]||120;
    const sec=digitField({placeholder:'sek',maxLength:maxSec>=100?3:2,max:maxSec,width:105});
    const hun=digitField({placeholder:'00',maxLength:2,max:99,width:76});
    function sync(){if(sec.value===''||hun.value===''){syncMark('');return;}syncMark(`${Number(sec.value)},${String(Number(hun.value)).padStart(2,'0')}`);}
    sec.addEventListener('input',sync);hun.addEventListener('input',sync);
    editor.append(sec,sep(','),hun,unit('sek'));
    hint.textContent=`Kun tall. Maks ${maxSec} sekunder og 99 hundredeler. Du skal ikke skrive komma.`;
  }

  function makeLongRaceEditor(code){
    editor.innerHTML='';
    const maxMin={800m:9,1500m:14,3000mSC:30,5000m:60,10000m:120}[code]||120;
    const min=digitField({placeholder:'min',maxLength:maxMin>=100?3:2,max:maxMin,width:92});
    const sec=digitField({placeholder:'sek',maxLength:2,max:59,width:82});
    const hun=digitField({placeholder:'00',maxLength:2,max:99,width:72});
    function sync(){if(min.value===''||sec.value===''||hun.value===''){syncMark('');return;}syncMark(`${Number(min.value)}:${String(Number(sec.value)).padStart(2,'0')},${String(Number(hun.value)).padStart(2,'0')}`);}
    [min,sec,hun].forEach(x=>x.addEventListener('input',sync));
    editor.append(min,sep(':'),sec,sep(','),hun,unit('min:sek'));
    hint.textContent='Kun tall. Sekunder er begrenset til 0–59 og hundredeler til 0–99.';
  }

  function makeTechnicalEditor(code){
    editor.innerHTML='';
    const maxM={HJ:3,PV:7,LJ:10,TJ:20,SP:30,DT:100,HT:100,JT:120}[code]||120;
    const metres=digitField({placeholder:'m',maxLength:maxM>=100?3:2,max:maxM,width:95});
    const cm=digitField({placeholder:'cm',maxLength:2,max:99,width:76});
    function sync(){if(metres.value===''||cm.value===''){syncMark('');return;}syncMark(`${Number(metres.value)},${String(Number(cm.value)).padStart(2,'0')}`);}
    metres.addEventListener('input',sync);cm.addEventListener('input',sync);
    editor.append(metres,sep(','),cm,unit('m'));
    hint.textContent=`Kun tall. Hele meter er begrenset til maks ${maxM}; centimeter til 0–99.`;
  }

  function makeCombinedEditor(code){
    editor.innerHTML='';
    const max=code==='Heptathlon'?9000:12000;
    const points=digitField({placeholder:'poeng',maxLength:5,max,width:170});
    points.addEventListener('input',()=>syncMark(points.value));
    editor.append(points,unit('poeng'));
    hint.textContent=`Kun hele poeng, maks ${max}.`;
  }

  function rebuildResultEditor(){
    const code=eventSelect.value;
    if(['Decathlon','Heptathlon'].includes(code))makeCombinedEditor(code);
    else if(['HJ','PV','LJ','TJ','SP','DT','HT','JT'].includes(code))makeTechnicalEditor(code);
    else if(['800m','1500m','5000m','10000m','3000mSC'].includes(code))makeLongRaceEditor(code);
    else makeSprintEditor(code);
    syncMark('');
  }

  function refreshWind(){
    const visible=windSection&&getComputedStyle(windSection).display!=='none';
    windCompact.style.display=visible?'grid':'none';
    windCompact.innerHTML='';
    if(!visible)return;
    if(wind?.closest('label'))windCompact.appendChild(wind.closest('label'));
    if(windAdjustment?.closest('label'))windCompact.appendChild(windAdjustment.closest('label'));
    windSection.style.display='none';
  }

  const rsObserver=new MutationObserver(refreshScores);
  rsObserver.observe(resultScore,{attributes:true,attributeFilter:['value']});
  resultScore.addEventListener('input',refreshScores);
  resultScore.addEventListener('change',refreshScores);
  document.addEventListener('input',e=>{if(e.target===mark)setTimeout(refreshScores,0);});

  eventSelect.addEventListener('change',()=>setTimeout(()=>{rebuildResultEditor();refreshScores();refreshWind();},80));
  category.addEventListener('change',()=>setTimeout(refreshScores,0));
  placing.addEventListener('change',()=>setTimeout(refreshScores,0));
  const windObserver=new MutationObserver(()=>setTimeout(refreshWind,0));
  if(windSection)windObserver.observe(windSection,{attributes:true,attributeFilter:['style']});

  rebuildResultEditor();refreshScores();setTimeout(refreshWind,120);
})();