const SCORING_URL = "https://raw.githubusercontent.com/lbouchard450/wa-scoring-tables/main/wa_scoring_tables_2025.min.json";

const placingTables = {
  standard: {
    OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],
    DF:[170,150,130,120,110,100,95,90,63,56,49,42],
    GW:[140,120,110,100,90,80,75,70,49,42,35,32],
    GL:[120,105,95,85,75,70,65,60,42,35,31,28],
    A:[100,84,77,70,63,56,49,42,35,31,27,24],
    B:[70,56,49,42,38,34,30,27,24,21,18,15],
    C:[42,35,31,28,25,22,19,16,14,12,10,8],
    D:[28,24,21,18,15,13,12,11],
    E:[18,15,13,11,9,7],
    F:[11,7,4]
  },
  distance: {
    OW:[215,190,170,155,140,130],
    DF:[130,115,100,87,80,73],
    GW:[115,95,85,77,70,63],
    GL:[95,85,77,70,63,56],
    A:[70,63,56,49,42,35],
    B:[50,42,35,31,27,24],
    C:[35,28,24,21,18,16],
    D:[25,19,15,13,11,9],
    E:[14,11,9,8,7,6],
    F:[8,5,3]
  },
  tenk: {
    OW:[200,175,160,145,130,120,110,100],
    DF:[125,105,95,85,75,67,60,53],
    GW:[100,85,75,65,56,49,42,35],
    GL:[80,65,55,46,39,35,31,28],
    A:[56,49,42,35,31,27,24,21],
    B:[42,35,31,27,24,21,18,15],
    C:[32,27,22,18,15,13,12,11],
    D:[21,15,13,11,10,9,8,7],
    E:[14,10,7,6,5,4],
    F:[7,4,2]
  },
  combined: {
    OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],
    DF:[125,105,95,85,75,67,60,53,35,28,24,21],
    GW:[100,85,75,65,56,49,42,35,25,21,17,13],
    GL:[80,65,55,46,39,35,31,28,21,17,14,11],
    A:[56,49,42,35,31,27,24,21,15,13,11,9],
    B:[42,35,31,27,24,21,18,15,13,11,9,8],
    C:[32,27,22,18,15,13,12,11,10,9,8,7],
    D:[21,15,13,11,10,9,8,7],
    E:[14,10,7,6,5,4],
    F:[7,4,2]
  }
};

const requirements = {
  standard:{n:5, label:"Vanlige bane-/tekniske øvelser", text:"5 tellende Performance Scores (normalt minst 3 i Main Event)"},
  distance:{n:3, label:"5000 m / 3000 m hinder", text:"3 tellende Performance Scores (minst 2 i Main Event)"},
  tenk:{n:2, label:"10 000 m", text:"2 tellende Performance Scores (minst 1 i Main Event)"},
  combined:{n:2, label:"Mangekamp", text:"2 tellende Performance Scores (minst 1 i Main Event)"}
};

const eventDefinitions = [
  ["100m","100 m"],["200m","200 m"],["400m","400 m"],["800m","800 m"],["1500m","1500 m"],
  ["5000m","5000 m"],["10000m","10 000 m"],["100mH","100 m hekk"],["110mH","110 m hekk"],
  ["400mH","400 m hekk"],["3000mSC","3000 m hinder"],["HJ","Høyde"],["PV","Stav"],["LJ","Lengde"],
  ["TJ","Tresteg"],["SP","Kule"],["DT","Diskos"],["HT","Slegge"],["JT","Spyd"],
  ["Decathlon","Tikamp"],["Heptathlon","Sjukamp"]
];

const demoMeets = [
  {name:"Hypo-Meeting Götzis", country:"AUT", place:"Götzis, Østerrike", cat:"GL", events:["Tikamp","Sjukamp"], prize:"Premieinfo: kobles inn", entry:"Påmelding/kontakt: kobles inn"},
  {name:"Decastar Talence", country:"FRA", place:"Talence, Frankrike", cat:"GL", events:["Tikamp","Sjukamp"], prize:"Premieinfo: kobles inn", entry:"Påmelding/kontakt: kobles inn"},
  {name:"Bislett Games", country:"NOR", place:"Oslo, Norge", cat:"GW", events:["Utvalgte løp","Tekniske øvelser"], prize:"Premieinfo: kobles inn", entry:"Invitasjonsstevne"},
  {name:"Paavo Nurmi Games", country:"FIN", place:"Turku, Finland", cat:"A", events:["Løp","Hopp","Kast"], prize:"Premieinfo: kobles inn", entry:"Påmelding/kontakt: kobles inn"}
];

let scoringData = null;
let activeGroup = "standard";

const sex = document.getElementById("sex");
const eventSelect = document.getElementById("event");
const markInput = document.getElementById("mark");
const resultScoreInput = document.getElementById("resultScore");
const category = document.getElementById("category");
const placing = document.getElementById("placing");
const requiredText = document.getElementById("requiredText");
const scoreInputs = document.getElementById("scoreInputs");
const eventGroupLabel = document.getElementById("eventGroupLabel");
const markHint = document.getElementById("markHint");
const dataStatus = document.getElementById("dataStatus");

function groupForEvent(code) {
  if (code === "5000m" || code === "3000mSC") return "distance";
  if (code === "10000m") return "tenk";
  if (code === "Decathlon" || code === "Heptathlon") return "combined";
  return "standard";
}

function populateEvents() {
  const section = scoringData?.[sex.value] || {};
  const available = eventDefinitions.filter(([code]) => section[code]);
  eventSelect.innerHTML = available.map(([code,label]) => `<option value="${code}">${label}</option>`).join("");
  updateEventUI();
}

function updateEventUI() {
  const code = eventSelect.value;
  const evt = scoringData?.[sex.value]?.[code];
  activeGroup = groupForEvent(code);
  eventGroupLabel.value = requirements[activeGroup].label;
  requiredText.textContent = requirements[activeGroup].text;

  if (evt?.unit === "seconds") markHint.textContent = "Tid: f.eks. 10,32 eller 1:45,20.";
  else if (evt?.unit === "meters") markHint.textContent = "Lengde/høyde i meter: f.eks. 7,85.";
  else if (evt?.unit === "points") markHint.textContent = "Poengsum: f.eks. 8200.";
  else markHint.textContent = "Skriv inn resultatet.";

  markInput.value = "";
  resultScoreInput.value = "";
  rebuildPlacing();
  rebuildScores();
}

function parseMark(raw, unit) {
  const s = String(raw).trim().replace(",", ".");
  if (!s) return NaN;
  if (unit === "seconds" && s.includes(":")) {
    const parts = s.split(":").map(Number);
    if (parts.some(v => !Number.isFinite(v))) return NaN;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return Number(s);
}

function lookupResultScore() {
  const evt = scoringData?.[sex.value]?.[eventSelect.value];
  if (!evt) return null;
  const perf = parseMark(markInput.value, evt.unit);
  if (!Number.isFinite(perf)) return null;

  for (const [pts, tableMark] of evt.data) {
    if (evt.direction === "min" && tableMark >= perf) return pts;
    if (evt.direction === "max" && tableMark <= perf) return pts;
  }
  return null;
}

function refreshResultScore() {
  const score = lookupResultScore();
  resultScoreInput.value = score ?? "";
}

function rebuildPlacing() {
  const table = placingTables[activeGroup]?.[category.value] || [];
  placing.innerHTML = table.map((_,i)=>`<option value="${i+1}">${i+1}. plass</option>`).join("");
}

function rebuildScores() {
  const req = requirements[activeGroup];
  requiredText.textContent = req.text;
  scoreInputs.innerHTML = Array.from({length:req.n},(_,i)=>
    `<label>Score ${i+1}<input class="existingScore" type="number" min="0" step="1" placeholder="f.eks. 1185"></label>`
  ).join("");
}

sex.addEventListener("change", populateEvents);
eventSelect.addEventListener("change", updateEventUI);
markInput.addEventListener("input", refreshResultScore);
category.addEventListener("change", rebuildPlacing);

document.getElementById("fillDemo").addEventListener("click",()=>{
  const vals = activeGroup === "standard" ? [1196,1188,1179,1168,1152]
    : activeGroup === "distance" ? [1188,1170,1152]
    : activeGroup === "combined" ? [1167,1138]
    : [1172,1145];
  document.querySelectorAll(".existingScore").forEach((el,i)=>el.value=vals[i] ?? "");
});

document.getElementById("calculate").addEventListener("click",()=>{
  const resultScore = lookupResultScore();
  if (resultScore == null) {
    alert("Skriv inn et gyldig resultat som finnes innenfor World Athletics-tabellen.");
    return;
  }

  const cat = category.value;
  const p = Number(placing.value);
  const ps = (placingTables[activeGroup][cat] || [])[p-1] || 0;
  const newPerf = resultScore + ps;
  const existing = [...document.querySelectorAll(".existingScore")]
    .map(x=>Number(x.value)).filter(x=>Number.isFinite(x)&&x>0);
  const n = requirements[activeGroup].n;

  if (existing.length < n) {
    alert(`Legg inn ${n} nåværende Performance Scores først.`);
    return;
  }

  const currentUsed = [...existing].sort((a,b)=>b-a).slice(0,n);
  const currentRank = Math.floor(currentUsed.reduce((a,b)=>a+b,0)/n);
  const candidates = [...currentUsed, newPerf].sort((a,b)=>b-a).slice(0,n);
  const newRank = Math.floor(candidates.reduce((a,b)=>a+b,0)/n);
  const improvement = newRank-currentRank;
  const lowest = Math.min(...currentUsed);
  const replaces = newPerf > lowest;

  document.getElementById("resultScoreOut").textContent = resultScore;
  document.getElementById("placingScoreOut").textContent = ps;
  document.getElementById("performanceScoreOut").textContent = newPerf;
  document.getElementById("newRankingOut").textContent = newRank;

  const imp = document.getElementById("improvement");
  imp.className = "improvement " + (improvement>0 ? "good" : improvement<0 ? "bad" : "");
  imp.textContent = improvement>0 ? `+${improvement} rankingpoeng` : improvement===0 ? "Ingen endring i rankingpoeng" : `${improvement} rankingpoeng`;
  document.getElementById("currentRankingLine").textContent = `Nåværende Ranking Score: ${currentRank}`;
  document.getElementById("replaceInfo").textContent = replaces
    ? `Resultatet går inn og erstatter nåværende svakeste tellende score på ${lowest}.`
    : `Resultatet går ikke inn blant de ${n} tellende scorene. Det må over ${lowest} i Performance Score for å forbedre grunnlaget.`;
  document.getElementById("resultBox").classList.remove("hidden");
});

function renderMeets() {
  const cat = document.getElementById("meetCategoryFilter").value;
  const country = document.getElementById("countryFilter").value;
  const list = demoMeets.filter(m => (cat==="all"||m.cat===cat) && (country==="all"||m.country===country));
  document.getElementById("meetList").innerHTML = list.map(m=>`
    <article class="meet-card">
      <div class="meet-top">
        <div><h4>${m.name}</h4><div class="meta">${m.place}</div></div>
        <span class="cat">${m.cat}</span>
      </div>
      <div class="chips">${m.events.map(e=>`<span class="chip">${e}</span>`).join("")}</div>
      <div class="meta">${m.prize}<br>${m.entry}</div>
      <div class="card-actions">
        <button onclick="alert('Kart kobles inn i neste versjon')">Vis i kart</button>
        <button onclick="alert('Detaljside kobles inn i neste versjon')">Detaljer</button>
      </div>
    </article>`).join("") || `<p class="muted">Ingen treff med valgte filtre.</p>`;
}

document.getElementById("meetCategoryFilter").addEventListener("change",renderMeets);
document.getElementById("countryFilter").addEventListener("change",renderMeets);

async function init() {
  renderMeets();
  try {
    const response = await fetch(SCORING_URL, {cache:"force-cache"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    scoringData = await response.json();
    dataStatus.textContent = "WA-tabell 2025 klar";
    populateEvents();
  } catch (err) {
    console.error(err);
    dataStatus.textContent = "Scoringdata kunne ikke lastes";
    eventSelect.innerHTML = `<option>Ingen data</option>`;
    eventGroupLabel.value = "–";
    requiredText.textContent = "Koble til internett og last siden på nytt.";
  }
}

init();
