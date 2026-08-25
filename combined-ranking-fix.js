// Rankingstevner v0.22.4 – robust Result Score for tikamp og sjukamp
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

  // Verifiserte WA-eksempler brukt som fallback dersom den eksterne tabellen
  // ikke inneholder combined events. Første verdi er prestasjonspoeng, andre Result Score.
  const decathlonAnchors = [
    [7606,1065],[7615,1067],[7729,1084],[7739,1086],[7745,1087],[7754,1088],
    [8001,1126],[8002,1127],[8188,1155],[8200,1157],[8402,1189],[8413,1190],
    [8420,1191],[8428,1193],[8431,1193],[8433,1193],[8538,1210],[8635,1225],
    [8703,1235],[8784,1248],[8804,1251],[8909,1268]
  ];

  const heptathlonAnchors = [
    [5651,1007],[5657,1008],[5663,1009],[5671,1011],[5685,1013],[5686,1014],[5694,1015],
    [5975,1070],[5983,1072],[5989,1073],[5995,1074],[6000,1075],[6003,1075],[6010,1077],
    [6017,1078],[6023,1079],[6024,1080],[6050,1085]
  ];

  function parseCombinedMark(raw){
    const s=String(raw ?? '').trim().replace(',','.');
    if(!s) return null;
    const n=Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function interpolateAnchors(mark, anchors){
    if(!Number.isFinite(mark) || !Array.isArray(anchors) || anchors.length < 2) return null;
    const rows=anchors.slice().sort((a,b)=>a[0]-b[0]);
    for(const [m,p] of rows){ if(m===mark) return p; }
    if(mark<=rows[0][0]){
      const [m1,p1]=rows[0],[m2,p2]=rows[1];
      return Math.round(p1+(mark-m1)*(p2-p1)/(m2-m1));
    }
    for(let i=0;i<rows.length-1;i++){
      const [m1,p1]=rows[i],[m2,p2]=rows[i+1];
      if(mark>=m1&&mark<=m2) return Math.round(p1+(mark-m1)*(p2-p1)/(m2-m1));
    }
    const [m1,p1]=rows[rows.length-2],[m2,p2]=rows[rows.length-1];
    return Math.round(p2+(mark-m2)*(p2-p1)/(m2-m1));
  }

  function scoreFromLoadedTable(code, markValue){
    try{
      const evt=(typeof scoringData!=='undefined' && typeof sex!=='undefined') ? scoringData?.[sex.value]?.[code] : null;
      if(!evt?.data || !Array.isArray(evt.data)) return null;
      for(const [pts,tableMark] of evt.data){
        if(Number(tableMark)===markValue) return Number(pts);
      }
      // Tabellen er mark->poeng. Finn nærmeste to markverdier og interpoler.
      const rows=evt.data.map(([pts,m])=>[Number(m),Number(pts)]).filter(([m,p])=>Number.isFinite(m)&&Number.isFinite(p)).sort((a,b)=>a[0]-b[0]);
      if(rows.length<2) return null;
      if(markValue<=rows[0][0]) return interpolateAnchors(markValue,rows);
      if(markValue>=rows[rows.length-1][0]) return interpolateAnchors(markValue,rows);
      return interpolateAnchors(markValue,rows);
    }catch(_){ return null; }
  }

  function combinedScore(code, raw){
    const markValue=parseCombinedMark(raw);
    if(markValue===null) return null;
    const fromTable=scoreFromLoadedTable(code,markValue);
    if(Number.isFinite(fromTable)) return fromTable;
    if(code==='Decathlon') return interpolateAnchors(markValue,decathlonAnchors);
    if(code==='Heptathlon') return interpolateAnchors(markValue,heptathlonAnchors);
    return null;
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

    let originalLookup=null;
    try{ originalLookup=lookupScoreFor; }catch(_){ }

    if(originalLookup && !window.__combinedLookupPatched224){
      window.__combinedLookupPatched224=true;
      window.lookupScoreFor=function(code,raw){
        if(code==='Decathlon'||code==='Heptathlon') return combinedScore(code,raw);
        return originalLookup(code,raw);
      };
    }

    function placingScore(){
      if(!category.value||!placing.value) return null;
      return combinedPlacing2026[category.value]?.[Number(placing.value)-1] ?? null;
    }

    function sync(){
      if(event.value!=='Decathlon'&&event.value!=='Heptathlon') return;
      const rs=combinedScore(event.value,mark.value);
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
