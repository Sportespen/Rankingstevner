const SCORING_URL = "https://raw.githubusercontent.com/lbouchard450/wa-scoring-tables/main/wa_scoring_tables_2025.min.json";

const placingTables = {
  standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
  distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
  tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
  combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
};

const requirements = {
  standard:{n:5,minMain:3,label:"Vanlige bane-/tekniske øvelser",text:"5 tellende Performance Scores – minst 3 må være Main Event"},
  distance:{n:3,minMain:2,label:"5000 m / 3000 m hinder",text:"3 tellende Performance Scores – minst 2 må være Main Event"},
  tenk:{n:2,minMain:1,label:"10 000 m",text:"2 tellende Performance Scores – minst 1 må være Main Event"},
  combined:{n:2,minMain:1,label:"Mangekamp",text:"2 tellende Performance Scores – minst 1 må være Main Event"}
};

const eventDefinitions = [
  ["100m","100 m"],["200m","200 m"],["400m","400 m"],["800m","800 m"],["1500m","1500 m"],
  ["5000m","5000 m"],["10000m","10 000 m"],["100mH","100 m hekk"],["110mH","110 m hekk"],
  ["400mH","400 m hekk"],["3000mSC","3000 m hinder"],["HJ","Høyde"],["PV","Stav"],["LJ","Lengde"],
  ["TJ","Tresteg"],["SP","Kule"],["DT","Diskos"],["HT","Slegge"],["JT","Spyd"],
  ["Decathlon","Tikamp"],["Heptathlon","Sjukamp"]
];

const windEvents = new Set(["100m","200m","100mH","110mH","LJ","TJ"]);
const jumpEvents = new Set(["LJ","TJ"]);

const demoMeets = [
  {name:"Hypo-Meeting Götzis",country:"AUT",place:"Götzis, Østerrike",cat:"GL",events:["Tikamp","Sjukamp"],prize:"Premieinfo: kobles inn",entry:"Påmelding/kontakt: kobles inn"},
  {name:"Decastar Talence",country:"FRA",place:"Talence, Frankrike",cat:"GL",events:["Tikamp","Sjukamp"],prize:"Premieinfo: kobles inn",entry:"Påmelding/kontakt: kobles inn"},
  {name:"Bislett Games",country:"NOR",place:"Oslo, Norge",cat:"GW",events:["Utvalgte løp","Tekniske øvelser"],prize:"Premieinfo: kobles inn",entry:"Invitasjonsstevne"},
  {name:"Paavo Nurmi Games",country:"FIN",place:"Turku, Finland",cat:"A",events:["Løp","Hopp","Kast"],prize:"Premieinfo: kobles inn",entry:"Påmelding/kontakt: kobles inn"}
];

let scoringData=null;
let activeGroup="standard";
const sex=document.getElementById("sex"), eventSelect=document.getElementById("event"), markInput=document.getElementById("mark"), resultScoreInput=document.getElementById("resultScore"), category=document.getElementById("category"), placing=document.getElementById("placing"), requiredText=document.getElementById("requiredText"), scoreInputs=document.getElementById("scoreInputs"), eventGroupLabel=document.getElementById("eventGroupLabel"), markHint=document.getElementById("markHint"), dataStatus=document.getElementById("dataStatus"), windSection=document.getElementById("windSection"), windInput=document.getElementById("wind"), windAdjustment=document.getElementById("windAdjustment"), bljMarkLabel=document.getElementById("bljMarkLabel"), bljWindLabel=document.getElementById("bljWindLabel"), bljMark=document.getElementById("bljMark"), bljWind=document.getElementById("bljWind"), combinedWindSection=document.getElementById("combinedWindSection"), combinedWindStatus=document.getElementById("combinedWindStatus"), mainRequirement=document.getElementById("mainRequirement");

function groupForEvent(code){if(code==="5000m"||code==="3000mSC")return"distance";if(code==="10000m")return"tenk";if(code==="Decathlon"||code==="Heptathlon")return"combined";return"standard";}
function fmt(v){return Number.isInteger(v)?String(v):v.toFixed(1).replace(".",",");}

function populateEvents(){
  const section=scoringData?.[sex.value]||{};
  const allowed=sex.value==='W'
    ? new Set(['100m','200m','400m','800m','1500m','5000m','10000m','100mH','400mH','3000mSC','HJ','PV','LJ','TJ','SP','DT','HT','JT','Heptathlon'])
    : new Set(['100m','200m','400m','800m','1500m','5000m','10000m','110mH','400mH','3000mSC','HJ','PV','LJ','TJ','SP','DT','HT','JT','Decathlon']);
  const available=eventDefinitions.filter(([code])=>allowed.has(code)&&section[code]);
  eventSelect.innerHTML=available.map(([code,label])=>`<option value="${code}">${label}</option>`).join("");
  updateEventUI();
}

function updateEventUI(){
  const code=eventSelect.value,evt=scoringData?.[sex.value]?.[code];activeGroup=groupForEvent(code);eventGroupLabel.value=requirements[activeGroup].label;requiredText.textContent=requirements[activeGroup].text;mainRequirement.textContent=`Minst ${requirements[activeGroup].minMain} Main Event-resultat${requirements[activeGroup].minMain>1?"er":""}.`;
  if(evt?.unit==="seconds")markHint.textContent="Tid: f.eks. 10,32 eller 1:45,20.";else if(evt?.unit==="meters")markHint.textContent="Lengde/høyde i meter: f.eks. 7,85.";else if(evt?.unit==="points")markHint.textContent="Poengsum: f.eks. 8200.";else markHint.textContent="Skriv inn resultatet.";
  markInput.value="";resultScoreInput.value="";windInput.value="";bljMark.value="";bljWind.value="";windAdjustment.value="0";combinedWindStatus.value="normal";
  const hasWind=windEvents.has(code),isJump=jumpEvents.has(code),isCombined=activeGroup==="combined";
  windSection.style.display=hasWind?"grid":"none";combinedWindSection.style.display=isCombined?"grid":"none";bljMarkLabel.style.display=isJump?"block":"none";bljWindLabel.style.display=isJump?"block":"none";
  rebuildPlacing();rebuildScores();refreshResultScore();
}

function parseMark(raw,unit){const s=String(raw).trim().replace(",",".");if(!s)return NaN;if(unit==="seconds"&&s.includes(":")){const p=s.split(":").map(Number);if(p.some(v=>!Number.isFinite(v)))return NaN;if(p.length===2)return p[0]*60+p[1];if(p.length===3)return p[0]*3600+p[1]*60+p[2];}return Number(s);}
function lookupScoreFor(code,raw){const evt=scoringData?.[sex.value]?.[code];if(!evt)return null;const perf=parseMark(raw,evt.unit);if(!Number.isFinite(perf))return null;for(const[pts,tableMark]of evt.data){if(evt.direction==="min"&&tableMark>=perf)return pts;if(evt.direction==="max"&&tableMark<=perf)return pts;}return null;}
function parseWind(raw){const s=String(raw).trim().toUpperCase().replace(",",".");if(!s)return null;if(s==="NWI")return"NWI";const v=Number(s);return Number.isFinite(v)?v:null;}
function windModFor(raw){const w=parseWind(raw);if(w===null)return null;if(w==="NWI")return-30;if(w<0)return Math.abs(w)*6;if(w>2)return-w*6;return 0;}

// A WA Result Score is always a whole number - it's a direct lookup in an integer-valued scoring
// table, never a computed fraction. windModFor()'s formula (points per m/s of excess wind) can
// legitimately land on a fractional value for a non-round wind reading (e.g. +2.2 m/s -> -13.2),
// and nothing downstream ever rounded that back to a real WA score before using or displaying it -
// confirmed live as "974,8"/"1009,8" Result/Performance Scores, which cannot be real WA values and
// then fed straight into the Ranking Score average, making a comma-bearing Result Score not just a
// display glitch but a genuine input error into everything computed from it. Rounding to the
// nearest whole point here, at the source, fixes it for every consumer at once (this file's own
// calculate() handler, trinn3.js's live preview, and anything reading resultScore.value downstream).
function adjustedResultDetails(){
  const code=eventSelect.value;const base=lookupScoreFor(code,markInput.value);if(base==null)return null;
  if(activeGroup==="combined"){const mod=combinedWindStatus.value==="normal"?0:-24;return{base,adjusted:base+mod,windMod:mod,usedBLJ:false};}
  if(!windEvents.has(code))return{base,adjusted:base,windMod:0,usedBLJ:false};
  const mod=windModFor(windInput.value);if(mod===null)return{base,adjusted:base,windMod:null,usedBLJ:false};
  let best=base+mod,usedBLJ=false;
  if(jumpEvents.has(code)){const finalWind=parseWind(windInput.value);if(typeof finalWind==="number"&&finalWind>2&&String(bljMark.value).trim()){
    const legalWind=parseWind(bljWind.value);const bljBase=lookupScoreFor(code,bljMark.value);
    if(bljBase!=null&&typeof legalWind==="number"&&legalWind<=2){const bljMod=windModFor(bljWind.value)??0;const bljAdjusted=bljBase+bljMod;if(bljAdjusted>best){best=bljAdjusted;usedBLJ=true;}}
  }}
  return{base,adjusted:Math.round(best),windMod:mod,usedBLJ};
}

function refreshResultScore(){const d=adjustedResultDetails();resultScoreInput.value=d?fmt(d.adjusted):"";if(windEvents.has(eventSelect.value)){const mod=windModFor(windInput.value);windAdjustment.value=mod===null?"–":`${mod>0?"+":""}${fmt(mod)}`;}else if(activeGroup==="combined")windAdjustment.value=combinedWindStatus.value==="normal"?"0":"-24";}
function rebuildPlacing(){const table=placingTables[activeGroup]?.[category.value]||[];placing.innerHTML=table.map((_,i)=>`<option value="${i+1}">${i+1}. plass</option>`).join("");}
function rebuildScores(){const req=requirements[activeGroup];requiredText.textContent=req.text;scoreInputs.innerHTML=Array.from({length:req.n},(_,i)=>`<label>Score ${i+1}<input class="existingScore" type="number" min="0" step="0.1" placeholder="f.eks. 1185"><select class="existingType" style="margin-top:6px"><option value="main">Main Event</option><option value="similar">Similar Event</option></select></label>`).join("");}

sex.addEventListener("change",populateEvents);eventSelect.addEventListener("change",updateEventUI);markInput.addEventListener("input",refreshResultScore);category.addEventListener("change",rebuildPlacing);windInput.addEventListener("input",refreshResultScore);bljMark.addEventListener("input",refreshResultScore);bljWind.addEventListener("input",refreshResultScore);combinedWindStatus.addEventListener("change",refreshResultScore);

document.getElementById("fillDemo").addEventListener("click",()=>{const vals=activeGroup==="standard"?[1196,1188,1179,1168,1152]:activeGroup==="distance"?[1188,1170,1152]:activeGroup==="combined"?[1167,1138]:[1172,1145];document.querySelectorAll(".existingScore").forEach((el,i)=>el.value=vals[i]??"");document.querySelectorAll(".existingType").forEach((el,i)=>el.value=i<requirements[activeGroup].minMain?"main":"similar");});

function combinations(arr,k){const out=[];function rec(start,pick){if(pick.length===k){out.push([...pick]);return;}for(let i=start;i<=arr.length-(k-pick.length);i++){pick.push(arr[i]);rec(i+1,pick);pick.pop();}}rec(0,[]);return out;}
function bestValidSelection(entries,n,minMain){const valid=combinations(entries,n).filter(c=>c.filter(x=>x.type==="main").length>=minMain);if(!valid.length)return null;valid.sort((a,b)=>b.reduce((s,x)=>s+x.score,0)-a.reduce((s,x)=>s+x.score,0));return valid[0];}

document.getElementById("calculate").addEventListener("click",()=>{
  const details=adjustedResultDetails();if(!details){alert("Skriv inn et gyldig resultat som finnes innenfor World Athletics-tabellen.");return;}
  if(windEvents.has(eventSelect.value)&&parseWind(windInput.value)===null){alert("Legg inn vind, eller skriv NWI dersom vindinformasjon mangler.");return;}
  const req=requirements[activeGroup],scoreEls=[...document.querySelectorAll(".existingScore")],typeEls=[...document.querySelectorAll(".existingType")];
  // The 5 "Score N" fields are normally auto-filled by ranking-basis.js's fillScores() on its own
  // 140ms timer, decoupled from whenever the user actually clicks "Beregn" - "Anbefalte stevner"
  // (ranking-recommendations.js) computes its own current/projected Ranking Score straight from
  // window.__rankingstevnerReconstructedBasis with no such timer in between. Confirmed live: the
  // two can disagree (+13 shown in a recommendation card vs +15 here for the identical hypothetical
  // result) purely because these DOM fields still held an earlier snapshot than the basis the box
  // just computed with, even though bestValidSelection() itself is the exact same algorithm in both
  // places. Re-syncing these fields from that same always-fresh global right before reading them -
  // only when it matches the currently selected øvelse and has enough entries, i.e. the athlete has
  // an auto-detected WA profile - guarantees this calculator can never again disagree with the box
  // over the same input, while manual entry (no WA profile loaded) is untouched.
  const liveBasis=window.__rankingstevnerReconstructedBasis;
  if(liveBasis&&liveBasis.event===eventSelect.value&&Array.isArray(liveBasis.selected)&&liveBasis.selected.length>=req.n){
    liveBasis.selected.slice(0,scoreEls.length).forEach((x,i)=>{scoreEls[i].value=String(x.performanceScore);if(typeEls[i])typeEls[i].value=x.type||"main";});
  }
  const existing=scoreEls.map((el,i)=>({score:Number(el.value),type:typeEls[i].value,label:`Score ${i+1}`})).filter(x=>Number.isFinite(x.score)&&x.score>0);
  if(existing.length<req.n){alert(`Legg inn ${req.n} nåværende Performance Scores først.`);return;}
  const currentSel=bestValidSelection(existing,req.n,req.minMain);if(!currentSel){alert(`De nåværende resultatene må inneholde minst ${req.minMain} Main Event-resultat${req.minMain>1?"er":""}.`);return;}
  const ps=(placingTables[activeGroup][category.value]||[])[Number(placing.value)-1]||0;const newPerf=details.adjusted+ps;const currentRank=Math.floor(currentSel.reduce((s,x)=>s+x.score,0)/req.n);
  const newEntry={score:newPerf,type:"main",label:"Nytt resultat"};const newSel=bestValidSelection([...existing,newEntry],req.n,req.minMain);const newRank=Math.floor(newSel.reduce((s,x)=>s+x.score,0)/req.n);const improvement=newRank-currentRank;const included=newSel.includes(newEntry);const replaced=included?currentSel.filter(x=>!newSel.includes(x)).sort((a,b)=>a.score-b.score)[0]:null;
  document.getElementById("resultScoreOut").textContent=fmt(details.adjusted);document.getElementById("placingScoreOut").textContent=fmt(ps);document.getElementById("performanceScoreOut").textContent=fmt(newPerf);document.getElementById("newRankingOut").textContent=newRank;
  const imp=document.getElementById("improvement");imp.className="improvement "+(improvement>0?"good":improvement<0?"bad":"");imp.textContent=improvement>0?`+${improvement} rankingpoeng`:improvement===0?"Ingen endring i rankingpoeng":`${improvement} rankingpoeng`;
  document.getElementById("currentRankingLine").textContent=`Nåværende Ranking Score: ${currentRank}`;
  document.getElementById("replaceInfo").textContent=included?(replaced?`Resultatet går inn og erstatter ${replaced.label} på ${fmt(replaced.score)}.`:"Resultatet går inn blant de tellende scorene."):`Resultatet går ikke inn blant de ${req.n} tellende scorene.`;
  const rules=[];if(windEvents.has(eventSelect.value)){rules.push(`Vindjustering: ${details.windMod>0?"+":""}${fmt(details.windMod??0)} poeng.`);if(details.usedBLJ)rules.push("Best Legal Jump ga bedre justert Result Score og ble brukt.");}if(activeGroup==="combined"&&combinedWindStatus.value!=="normal")rules.push("Mangekamp: -24 poeng for vindregel.");rules.push(`Main Event-kravet (${req.minMain} av ${req.n}) er oppfylt.`);document.getElementById("ruleInfo").textContent=rules.join(" ");document.getElementById("resultBox").classList.remove("hidden");
});

function renderMeets(){
  const catEl=document.getElementById("meetCategoryFilter"),countryEl=document.getElementById("countryFilter"),meetList=document.getElementById("meetList");
  if(!catEl||!countryEl||!meetList)return;
  const cat=catEl.value,country=countryEl.value,list=demoMeets.filter(m=>(cat==="all"||m.cat===cat)&&(country==="all"||m.country===country));
  meetList.innerHTML=list.map(m=>`<article class="meet-card"><div class="meet-top"><div><h4>${m.name}</h4><div class="meta">${m.place}</div></div><span class="cat">${m.cat}</span></div><div class="chips">${m.events.map(e=>`<span class="chip">${e}</span>`).join("")}</div><div class="meta">${m.prize}<br>${m.entry}</div><div class="card-actions"><button onclick="alert('Kart kobles inn i neste versjon')">Vis i kart</button><button onclick="alert('Detaljside kobles inn i neste versjon')">Detaljer</button></div></article>`).join("")||`<p class="muted">Ingen treff med valgte filtre.</p>`;
}
const legacyMeetCategory=document.getElementById("meetCategoryFilter"),legacyCountryFilter=document.getElementById("countryFilter");
if(legacyMeetCategory&&legacyCountryFilter){legacyMeetCategory.addEventListener("change",renderMeets);legacyCountryFilter.addEventListener("change",renderMeets);}

async function init(){
  renderMeets();
  try{
    const response=await fetch(SCORING_URL,{cache:"force-cache"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    scoringData=await response.json();
    dataStatus.textContent="WA-tabell 2025 klar";
    populateEvents();
  }catch(err){
    console.error(err);
    dataStatus.textContent="Scoringdata kunne ikke lastes";
    eventSelect.innerHTML=`<option>Ingen data</option>`;
    eventGroupLabel.value="–";
    requiredText.textContent="Koble til internett og last siden på nytt.";
  }
}
init();
