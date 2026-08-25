// Rankingstevner v0.16.3 – sikker Tikamp/Combined Events-beregning
(() => {
  'use strict';

  const combinedPlacing2026 = {
    OW:[280,250,225,205,185,170,155,145,95,85,75,65,60,55,50,46],
    DF:[175,150,135,120,105,95,85,75,50,40,35,30],
    GW:[140,120,105,90,80,70,60,50,35,30,24,18],
    GL:[110,90,75,65,55,50,45,40,30,25,20,15],
    A:[80,70,60,50,45,40,35,30],
    B:[60,50,45,40,35,30,25,20],
    C:[45,38,32,26,22,19,17,15],
    D:[30,22,18,16,14,12,11,10],
    E:[20,14,10,8,7,6],
    F:[10,6,3]
  };

  const decathlonAnchors = [
    [7606,1065],[7615,1067],[7729,1084],[7739,1086],[7745,1087],[7754,1088],
    [8001,1126],[8002,1127],[8188,1155],[8200,1157],[8402,1189],[8413,1190],
    [8420,1191],[8428,1193],[8431,1193],[8433,1193],[8538,1210],[8635,1225],
    [8703,1235],[8784,1248],[8804,1251],[8909,1268]
  ];

  function interpolateScore(mark, anchors){
    if(!Number.isFinite(mark)) return null;
    if(mark <= anchors[0][0]){
      const [x1,y1]=anchors[0], [x2,y2]=anchors[1];
      return Math.round(y1 + (mark-x1)*(y2-y1)/(x2-x1));
    }
    for(let i=0;i<anchors.length-1;i++){
      const [x1,y1]=anchors[i], [x2,y2]=anchors[i+1];
      if(mark===x1) return y1;
      if(mark>=x1 && mark<=x2){
        return Math.round(y1 + (mark-x1)*(y2-y1)/(x2-x1));
      }
    }
    const [x1,y1]=anchors[anchors.length-2], [x2,y2]=anchors[anchors.length-1];
    return Math.round(y2 + (mark-x2)*(y2-y1)/(x2-x1));
  }

  function parseCombinedMark(raw){
    const s=String(raw ?? '').trim().replace(',','.');
    if(!s) return null;
    const n=Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function install(){
    const event=document.getElementById('event');
    const category=document.getElementById('category');
    const placing=document.getElementById('placing');
    const mark=document.getElementById('mark');
    const resultScore=document.getElementById('resultScore');
    const resultOut=document.getElementById('resultScoreMirror');
    const placingOut=document.getElementById('placingScorePreview');
    const performanceOut=document.getElementById('performanceScorePreview');
    if(!event||!category||!placing||!mark||!resultScore||!resultOut||!placingOut||!performanceOut){setTimeout(install,100);return;}

    try{ if(typeof placingTables!=='undefined') placingTables.combined=combinedPlacing2026; }catch(_){ }

    try{
      const original=lookupScoreFor;
      window.lookupScoreFor=function(code,raw){
        if(code==='Decathlon'){
          const n=parseCombinedMark(raw);
          return n===null ? null : interpolateScore(n,decathlonAnchors);
        }
        return original(code,raw);
      };
    }catch(_){ }

    function placingScore(){
      if(event.value!=='Decathlon' || !category.value || !placing.value) return null;
      return combinedPlacing2026[category.value]?.[Number(placing.value)-1] ?? null;
    }

    function sync(){
      if(event.value!=='Decathlon') return;
      const n=parseCombinedMark(mark.value);
      const ps=placingScore();
      if(n===null){
        resultScore.value='';
        resultOut.textContent='–';
        placingOut.textContent=ps==null?'–':String(ps);
        performanceOut.textContent='–';
        return;
      }
      const rs=interpolateScore(n,decathlonAnchors);
      resultScore.value=String(rs);
      resultOut.textContent=String(rs);
      placingOut.textContent=ps==null?'–':String(ps);
      performanceOut.textContent=ps==null?'–':String(rs+ps);
    }

    ['input','change'].forEach(type=>mark.addEventListener(type,()=>setTimeout(sync,0)));
    category.addEventListener('change',()=>setTimeout(sync,0));
    placing.addEventListener('change',()=>setTimeout(sync,0));
    event.addEventListener('change',()=>setTimeout(sync,50));
    new MutationObserver(()=>setTimeout(sync,0)).observe(resultOut.parentElement.parentElement,{childList:true,subtree:true,characterData:true});
    setTimeout(sync,200);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
