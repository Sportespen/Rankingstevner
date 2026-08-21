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
  standard:{n:5, text:"5 tellende Performance Scores (normalt minst 3 i Main Event)"},
  distance:{n:3, text:"3 tellende Performance Scores (minst 2 i Main Event)"},
  tenk:{n:2, text:"2 tellende Performance Scores (minst 1 i Main Event)"},
  combined:{n:2, text:"2 tellende Performance Scores (minst 1 i Main Event)"}
};

const demoMeets = [
  {name:"Hypo-Meeting Götzis", country:"AUT", place:"Götzis, Østerrike", cat:"GL", events:["Tikamp","Sjukamp"], prize:"Premieinfo: kobles inn", entry:"Påmelding/kontakt: kobles inn"},
  {name:"Decastar Talence", country:"FRA", place:"Talence, Frankrike", cat:"GL", events:["Tikamp","Sjukamp"], prize:"Premieinfo: kobles inn", entry:"Påmelding/kontakt: kobles inn"},
  {name:"Bislett Games", country:"NOR", place:"Oslo, Norge", cat:"GW", events:["Utvalgte løp","Tekniske øvelser"], prize:"Premieinfo: kobles inn", entry:"Invitasjonsstevne"},
  {name:"Paavo Nurmi Games", country:"FIN", place:"Turku, Finland", cat:"A", events:["Løp","Hopp","Kast"], prize:"Premieinfo: kobles inn", entry:"Påmelding/kontakt: kobles inn"}
];

const eventGroup = document.getElementById("eventGroup");
const category = document.getElementById("category");
const placing = document.getElementById("placing");
const requiredText = document.getElementById("requiredText");
const scoreInputs = document.getElementById("scoreInputs");

function rebuildPlacing() {
  const table = placingTables[eventGroup.value][category.value] || [];
  placing.innerHTML = table.map((_,i)=>`<option value="${i+1}">${i+1}. plass</option>`).join("");
}
function rebuildScores() {
  const req = requirements[eventGroup.value];
  requiredText.textContent = req.text;
  scoreInputs.innerHTML = Array.from({length:req.n},(_,i)=>
    `<label>Score ${i+1}<input class="existingScore" type="number" min="0" step="1" placeholder="f.eks. 1185"></label>`
  ).join("");
}
function refresh() { rebuildPlacing(); rebuildScores(); }
eventGroup.addEventListener("change", refresh);
category.addEventListener("change", rebuildPlacing);

document.getElementById("fillDemo").addEventListener("click",()=>{
  const vals = eventGroup.value==="standard" ? [1196,1188,1179,1168,1152]
    : eventGroup.value==="distance" ? [1188,1170,1152]
    : eventGroup.value==="combined" ? [1167,1138]
    : [1172,1145];
  document.querySelectorAll(".existingScore").forEach((el,i)=>el.value=vals[i] ?? "");
});

document.getElementById("calculate").addEventListener("click",()=>{
  const group = eventGroup.value;
  const cat = category.value;
  const p = Number(placing.value);
  const resultScore = Number(document.getElementById("resultScore").value);
  const ps = (placingTables[group][cat] || [])[p-1] || 0;
  const newPerf = resultScore + ps;
  const existing = [...document.querySelectorAll(".existingScore")].map(x=>Number(x.value)).filter(x=>Number.isFinite(x)&&x>0);
  const n = requirements[group].n;

  if (existing.length < n) {
    alert(`Legg inn ${n} nåværende Performance Scores først.`);
    return;
  }

  const currentUsed = [...existing].sort((a,b)=>b-a).slice(0,n);
  const currentAvgExact = currentUsed.reduce((a,b)=>a+b,0)/n;
  const currentRank = Math.floor(currentAvgExact);

  const candidates = [...currentUsed, newPerf].sort((a,b)=>b-a).slice(0,n);
  const newAvgExact = candidates.reduce((a,b)=>a+b,0)/n;
  const newRank = Math.floor(newAvgExact);
  const improvement = newRank-currentRank;
  const lowest = Math.min(...currentUsed);
  const replaces = newPerf > lowest;

  document.getElementById("placingScoreOut").textContent = ps;
  document.getElementById("performanceScoreOut").textContent = newPerf;
  document.getElementById("currentRankingOut").textContent = currentRank;
  document.getElementById("newRankingOut").textContent = newRank;
  const imp = document.getElementById("improvement");
  imp.className = "improvement " + (improvement>0 ? "good" : improvement<0 ? "bad" : "");
  imp.textContent = improvement>0 ? `+${improvement} rankingpoeng` : improvement===0 ? "Ingen endring i rankingpoeng" : `${improvement} rankingpoeng`;
  document.getElementById("replaceInfo").textContent = replaces
    ? `Resultatet går inn og erstatter nåværende svakeste tellende score på ${lowest}.`
    : `Resultatet går ikke inn blant de ${n} tellende scorene. Det må over ${lowest} for å forbedre grunnlaget.`;
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

refresh();
renderMeets();
