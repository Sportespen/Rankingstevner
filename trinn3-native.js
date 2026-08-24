// Rankingstevner v0.10.1 – robust øvelsestilpasset resultatfelt uten manuelle skilletegn
(function(){
  const mark=document.getElementById('mark');
  const resultScore=document.getElementById('resultScore');
  const eventSelect=document.getElementById('event');
  const category=document.getElementById('category');
  const placing=document.getElementById('placing');
  const editor=document.getElementById('safeResultEditor');
  const hint=document.getElementById('safeResultHint');
  const resultOut=document.getElementById('resultScoreMirror');
  const placingOut=document.getElementById('placingScorePreview');
  const performanceOut=document.getElementById('performanceScorePreview');
  if(!mark||!resultScore||!eventSelect||!category||!placing||!editor||!hint||!resultOut||!placingOut||!performanceOut)return;

  const placingTables={
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };

  function group(code){if(code==='5000m'||code==='3000mSC')return'distance';if(code==='10000m')return'tenk';if(code==='Decathlon'||code==='Heptathlon')return'combined';return'standard';}
  function placingScore(){const arr=placingTables[group(eventSelect.value)]?.[category.value]||[];const p=Math.max(1,Number(placing.value)||1);const val=arr[p-1];return val==null?null:Number(val);}
  function refreshScores(){const raw=String(resultScore.value||'').trim();const rs=Number(raw.replace(',','.'));const ps=placingScore();resultOut.textContent=raw!==''&&Number.isFinite(rs)?String(Math.round(rs)):'–';placingOut.textContent=ps==null?'–':String(ps);performanceOut.textContent=raw!==''&&Number.isFinite(rs)&&ps!=null?String(Math.round(rs+ps)):'–';}
  function syncMark(value){mark.value=value;mark.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(refreshScores,0);setTimeout(refreshScores,60);}

  function field(ph,maxLength,max,width){
    const i=document.createElement('input');
    i.type='text'; i.inputMode='numeric'; i.autocomplete='off'; i.placeholder=ph; i.maxLength=maxLength;
    i.style.cssText=`width:${width}px;font-size:1.2rem;font-weight:800;text-align:center`;
    i.addEventListener('input',()=>{let v=i.value.replace(/\D/g,'').slice(0,maxLength);if(max!=null&&v!==''&&Number(v)>max)v=String(max);i.value=v;});
    return i;
  }
  function sep(t){const s=document.createElement('strong');s.textContent=t;s.style.cssText='font-size:1.25rem;color:#526170';return s;}
  function unit(t){const s=document.createElement('span');s.textContent=t;s.style.cssText='font-weight:800;color:#677585';return s;}

  function buildSprint(code){
    editor.innerHTML='';
    const maxSec={100m:30,200m:60,400m:120,100mH:40,110mH:40,400mH:120}[code]||120;
    const sec=field('sek',maxSec>=100?3:2,maxSec,105), hun=field('00',2,99,76);
    const sync=()=>{if(sec.value===''||hun.value==='')return syncMark('');syncMark(`${Number(sec.value)},${String(Number(hun.value)).padStart(2,'0')}`);};
    sec.addEventListener('input',sync); hun.addEventListener('input',sync);
    editor.append(sec,sep(','),hun,unit('sek'));
    hint.textContent='Skriv bare tall. Komma settes inn automatisk.';
  }
  function buildLong(code){
    editor.innerHTML='';
    const maxMin={800m:9,1500m:14,3000mSC:30,5000m:60,10000m:120}[code]||120;
    const min=field('min',maxMin>=100?3:2,maxMin,92), sec=field('sek',2,59,82), hun=field('00',2,99,72);
    const sync=()=>{if(min.value===''||sec.value===''||hun.value==='')return syncMark('');syncMark(`${Number(min.value)}:${String(Number(sec.value)).padStart(2,'0')},${String(Number(hun.value)).padStart(2,'0')}`);};
    [min,sec,hun].forEach(x=>x.addEventListener('input',sync));
    editor.append(min,sep(':'),sec,sep(','),hun,unit('min:sek'));
    hint.textContent='Skriv bare tall. Minutter, sekunder og hundredeler er separate felt.';
  }
  function buildTechnical(code){
    editor.innerHTML='';
    const maxM={HJ:3,PV:7,LJ:10,TJ:20,SP:30,DT:100,HT:100,JT:120}[code]||120;
    const m=field('m',maxM>=100?3:2,maxM,95), cm=field('cm',2,99,76);
    const sync=()=>{if(m.value===''||cm.value==='')return syncMark('');syncMark(`${Number(m.value)},${String(Number(cm.value)).padStart(2,'0')}`);};
    m.addEventListener('input',sync); cm.addEventListener('input',sync);
    editor.append(m,sep(','),cm,unit('m'));
    hint.textContent='Skriv bare tall. Meter og centimeter er separate felt.';
  }
  function buildCombined(code){
    editor.innerHTML='';
    const max=code==='Heptathlon'?9000:12000;
    const p=field('poeng',5,max,170);
    p.addEventListener('input',()=>syncMark(p.value));
    editor.append(p,unit('poeng'));
    hint.textContent='Kun hele poeng.';
  }

  let lastCode='__none__';
  function rebuild(force=false){
    const code=eventSelect.value || '100m';
    if(!force && code===lastCode && editor.children.length)return;
    lastCode=code;
    if(code==='Decathlon'||code==='Heptathlon')buildCombined(code);
    else if(['HJ','PV','LJ','TJ','SP','DT','HT','JT'].includes(code))buildTechnical(code);
    else if(['800m','1500m','5000m','10000m','3000mSC'].includes(code))buildLong(code);
    else buildSprint(code);
    syncMark(''); refreshScores();
  }

  // Vis alltid et gyldig resultatfelt umiddelbart, selv før øvelseslisten er ferdig lastet.
  rebuild(true);

  eventSelect.addEventListener('change',()=>rebuild(true));
  category.addEventListener('change',refreshScores);
  placing.addEventListener('change',refreshScores);
  resultScore.addEventListener('input',refreshScores);
  resultScore.addEventListener('change',refreshScores);

  // Robust sikkerhetsnett: oppdag endringer i valgt øvelse også når andre skript oppdaterer select-feltet.
  setInterval(()=>{const code=eventSelect.value||'100m';if(code!==lastCode||!editor.children.length)rebuild(true);refreshScores();},250);
})();
