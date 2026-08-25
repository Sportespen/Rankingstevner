// Rankingstevner v0.22.3 – robust Result Score for mangekamp
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

  function parseCombinedMark(raw){
    const s=String(raw ?? '').trim().replace(',','.');
    if(!s) return null;
    const n=Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function interpolate(mark, rows){
    if(!Number.isFinite(mark) || !Array.isArray(rows) || rows.length < 2) return null;
    const clean=rows
      .map(r=>[Number(r[0]),Number(r[1])])
      .filter(r=>Number.isFinite(r[0])&&Number.isFinite(r[1]))
      .sort((a,b)=>a[1]-b[1]);
    if(clean.length<2) return null;
    for(const [pts,m] of clean){ if(m===mark) return Math.round(pts); }
    if(mark<=clean[0][1]){
      const [p1,m1]=clean[0],[p2,m2]=clean[1];
      return Math.round(p1+(mark-m1)*(p2-p1)/(m2-m1));
    }
    for(let i=0;i<clean.length-1;i++){
      const [p1,m1]=clean[i],[p2,m2]=clean[i+1];
      if(mark>=m1&&mark<=m2) return Math.round(p1+(mark-m1)*(p2-p1)/(m2-m1));
    }
    const [p1,m1]=clean[clean.length-2],[p2,m2]=clean[clean.length-1];
    return Math.round(p2+(mark-m2)*(p2-p1)/(m2-m1));
  }

  function fallbackDecathlon(mark){ return interpolate(mark,decathlonAnchors.map(([m,p])=>[p,m])); }

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

    let originalLookup=null;
    try{ originalLookup=lookupScoreFor; }catch(_){ }

    if(originalLookup && !window.__combinedLookupPatched223){
      window.__combinedLookupPatched223=true;
      window.lookupScoreFor=function(code,raw){
        if(code==='Decathlon'||code==='Heptathlon'){
          const markValue=parseCombinedMark(raw);
          if(markValue===null) return null;
          try{
            const evt=(typeof scoringData!=='undefined' && typeof sex!=='undefined') ? scoringData?.[sex.value]?.[code] : null;
            const fromTable=evt?.data ? interpolate(markValue,evt.data) : null;
            if(Number.isFinite(fromTable)) return fromTable;
          }catch(_){ }
          if(code==='Decathlon') return fallbackDecathlon(markValue);
          return null;
        }
        return originalLookup(code,raw);
      };
    }

    function placingScore(){
      if(!category.value||!placing.value) return null;
      return combinedPlacing2026[category.value]?.[Number(placing.value)-1] ?? null;
    }

    function sync(){
      if(event.value!=='Decathlon'&&event.value!=='Heptathlon') return;
      let rs=null;
      try{ rs=lookupScoreFor(event.value,mark.value); }catch(_){ }
      const ps=placingScore();
      resultScore.value=Number.isFinite(rs)?String(rs):'';
      resultOut.textContent=Number.isFinite(rs)?String(rs):'–';
      placingOut.textContent=ps==null?'–':String(ps);
      performanceOut.textContent=Number.isFinite(rs)&&ps!=null?String(rs+ps):'–';
    }

    ['input','change'].forEach(type=>mark.addEventListener(type,()=>setTimeout(sync,0)));
    category.addEventListener('change',()=>setTimeout(sync,0));
    placing.addEventListener('change',()=>setTimeout(sync,0));
    event.addEventListener('change',()=>setTimeout(sync,50));
    setTimeout(sync,250);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
