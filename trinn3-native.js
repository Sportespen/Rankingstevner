// Rankingstevner Trinn 3 v0.10.3 – bygget på nytt fra bunnen.
(function(){
  function start(){
    const editor=document.getElementById('safeResultEditor');
    const hint=document.getElementById('safeResultHint');
    const mark=document.getElementById('mark');
    const resultScore=document.getElementById('resultScore');
    const eventSelect=document.getElementById('event');
    const category=document.getElementById('category');
    const placing=document.getElementById('placing');
    const resultOut=document.getElementById('resultScoreMirror');
    const placingOut=document.getElementById('placingScorePreview');
    const performanceOut=document.getElementById('performanceScorePreview');
    if(!editor||!hint||!mark||!resultScore||!eventSelect||!category||!placing||!resultOut||!placingOut||!performanceOut){setTimeout(start,100);return;}

    const tables={
      standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
      distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
      tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
      combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
    };

    const group=(code)=>code==='5000m'||code==='3000mSC'?'distance':code==='10000m'?'tenk':code==='Decathlon'||code==='Heptathlon'?'combined':'standard';
    const placingScore=()=>{const arr=tables[group(eventSelect.value)]?.[category.value]||[];const p=Math.max(1,Number(placing.value)||1);return arr[p-1]??null;};

    function refreshScores(){
      const raw=String(resultScore.value||'').trim();
      const rs=Number(raw.replace(',','.'));
      const ps=placingScore();
      resultOut.textContent=raw&&Number.isFinite(rs)?String(Math.round(rs)):'–';
      placingOut.textContent=ps==null?'–':String(ps);
      performanceOut.textContent=raw&&Number.isFinite(rs)&&ps!=null?String(Math.round(rs+ps)):'–';
    }
    function sendMark(v){mark.value=v;mark.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(refreshScores,20);setTimeout(refreshScores,120);}

    function makeInput(ph,maxLen,max,width){
      const el=document.createElement('input');
      el.type='text';el.inputMode='numeric';el.autocomplete='off';el.placeholder=ph;el.maxLength=maxLen;
      el.style.cssText=`width:${width}px;min-height:54px;font-size:1.25rem;font-weight:800;text-align:center;border:1px solid #cfd9df;border-radius:12px;padding:10px 12px;background:#fff`;
      el.addEventListener('input',()=>{let v=el.value.replace(/\D/g,'').slice(0,maxLen);if(v!==''&&max!=null&&Number(v)>max)v=String(max);el.value=v;});
      return el;
    }
    function textToken(text,tag='strong'){const el=document.createElement(tag);el.textContent=text;el.style.cssText='font-size:1.25rem;font-weight:800;color:#526170';return el;}
    function clear(){editor.innerHTML='';editor.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:58px;margin-top:4px';}

    function buildSprint(code){
      clear();
      const max={100m:30,200m:60,400m:120,100mH:40,110mH:40,400mH:120}[code]||120;
      const sec=makeInput('sek',max>=100?3:2,max,105), hun=makeInput('00',2,99,76);
      const sync=()=>sendMark(sec.value!==''&&hun.value!==''?`${Number(sec.value)},${String(Number(hun.value)).padStart(2,'0')}`:'');
      sec.addEventListener('input',sync);hun.addEventListener('input',sync);
      editor.append(sec,textToken(','),hun,textToken('sek','span'));
      hint.textContent='Skriv bare tall. Komma settes inn automatisk.';
    }
    function buildLong(code){
      clear();
      const max={800m:9,1500m:14,3000mSC:30,5000m:60,10000m:120}[code]||120;
      const min=makeInput('min',max>=100?3:2,max,92),sec=makeInput('sek',2,59,82),hun=makeInput('00',2,99,72);
      const sync=()=>sendMark(min.value!==''&&sec.value!==''&&hun.value!==''?`${Number(min.value)}:${String(Number(sec.value)).padStart(2,'0')},${String(Number(hun.value)).padStart(2,'0')}`:'');
      [min,sec,hun].forEach(x=>x.addEventListener('input',sync));
      editor.append(min,textToken(':'),sec,textToken(','),hun,textToken('min:sek','span'));
      hint.textContent='Skriv bare tall. Minutter, sekunder og hundredeler er separate felt.';
    }
    function buildTechnical(code){
      clear();
      const max={HJ:3,PV:7,LJ:10,TJ:20,SP:30,DT:100,HT:100,JT:120}[code]||120;
      const m=makeInput('m',max>=100?3:2,max,95),cm=makeInput('cm',2,99,76);
      const sync=()=>sendMark(m.value!==''&&cm.value!==''?`${Number(m.value)},${String(Number(cm.value)).padStart(2,'0')}`:'');
      m.addEventListener('input',sync);cm.addEventListener('input',sync);
      editor.append(m,textToken(','),cm,textToken('m','span'));
      hint.textContent='Skriv bare tall. Meter og centimeter er separate felt.';
    }
    function buildCombined(code){
      clear();
      const p=makeInput('poeng',5,code==='Heptathlon'?9000:12000,170);
      p.addEventListener('input',()=>sendMark(p.value));
      editor.append(p,textToken('poeng','span'));
      hint.textContent='Kun hele poeng.';
    }

    let last='';
    function rebuild(){
      const code=eventSelect.value||'100m';
      if(code===last&&editor.children.length)return;
      last=code;
      if(code==='Decathlon'||code==='Heptathlon')buildCombined(code);
      else if(['HJ','PV','LJ','TJ','SP','DT','HT','JT'].includes(code))buildTechnical(code);
      else if(['800m','1500m','5000m','10000m','3000mSC'].includes(code))buildLong(code);
      else buildSprint(code);
      sendMark('');refreshScores();
    }

    rebuild();
    eventSelect.addEventListener('change',()=>{last='';rebuild();});
    category.addEventListener('change',refreshScores);
    placing.addEventListener('change',refreshScores);
    resultScore.addEventListener('input',refreshScores);
    resultScore.addEventListener('change',refreshScores);
    new MutationObserver(()=>{last='';rebuild();}).observe(eventSelect,{childList:true});
    setInterval(()=>{if(!editor.children.length){last='';rebuild();}refreshScores();},500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
