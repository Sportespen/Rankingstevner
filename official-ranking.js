// Rankingstevner v0.22.2 – offisiell WA-ranking + offisielt rankinggrunnlag + korrekt hekk per kjønn
(function(){'use strict';
const eventSelect=document.getElementById('event'),sex=document.getElementById('sex'),waInput=document.getElementById('waProfileId'),waStatus=document.getElementById('waProfileStatus'),legacy=document.getElementById('waProfileDetails');if(!eventSelect||!sex||!waInput||!legacy)return;
let mount=document.getElementById('officialWaRankingDetails');if(!mount){mount=document.createElement('div');mount.id='officialWaRankingDetails';mount.style.cssText='display:none;margin-top:14px;margin-bottom:8px;padding:14px;border:1px solid #21405f;border-radius:10px;background:#0b1d33';legacy.insertAdjacentElement('afterend',mount);}let requestSeq=0;
// ranking-basis.js's local reconstruction box is only meant to show when this official lookup
// comes up empty - but the two run on separate, uncoordinated timers, so it used to sometimes
// render its own box before this one had finished, then never get told to remove it (the
// success event below only fired on a MATCH, never on a genuine "nothing found"). Marking
// pending/settled explicitly here lets ranking-basis.js wait for a real answer instead of
// guessing off its own clock, so at most one of the two ever ends up visible.
window.__rankingstevnerOfficialPending=true;
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const label=()=>eventSelect.options[eventSelect.selectedIndex]?.textContent||eventSelect.value;const validScore=v=>Number.isFinite(Number(v))&&Number(v)>0;
function ensureSexSpecificHurdle(){
  const women=sex.value==='W',want=women?'100mH':'110mH',wrong=women?'110mH':'100mH',wantLabel=women?'100 m hekk':'110 m hekk';
  const wasWrong=eventSelect.value===wrong;
  [...eventSelect.options].filter(o=>o.value===wrong).forEach(o=>o.remove());
  let wanted=[...eventSelect.options].find(o=>o.value===want);
  if(!wanted){
    wanted=document.createElement('option');wanted.value=want;wanted.textContent=wantLabel;
    const before=[...eventSelect.options].find(o=>o.value==='400mH');
    if(before)eventSelect.insertBefore(wanted,before);else eventSelect.appendChild(wanted);
  }else wanted.textContent=wantLabel;
  if(wasWrong){eventSelect.value=want;setTimeout(()=>eventSelect.dispatchEvent(new Event('change',{bubbles:true})),0);}
}
function fmtDate(v){if(!v)return'–';const d=new Date(v);if(Number.isNaN(d.getTime()))return esc(v);return d.toLocaleDateString('no-NO',{day:'2-digit',month:'2-digit',year:'numeric'});}
function renderLoading(){mount.style.display='block';mount.innerHTML=`<strong>Rankinggrunnlag for ${label()}:</strong><br><span class="muted">Henter offisiell ranking fra World Athletics …</span>`;}
// When there's no verified official ranking to show, ranking-basis.js's local reconstruction box
// already shows the real, useful information below this one - a "not found" message plus
// diagnostics here was just noise on top of that, so this box has nothing to show in that case.
// Clearing innerHTML alone still left an empty bordered/padded box visible (the mount's own
// styling), so it's hidden outright instead - shown again by renderLoading()/render() once
// there's actually something to display.
function renderNone(){mount.style.display='none';mount.innerHTML='';window.__rankingstevnerOfficialRanking=null;window.__rankingstevnerOfficialPending=false;window.dispatchEvent(new CustomEvent('rankingofficialloaded'));}
// Same Main/Similar Event classification ranking-basis.js's local reconstruction table already
// shows, so both boxes present the same information the same way. A plain individual event's
// rows will always come back "Main Event" (WA's own lookup only returns rows for that exact
// event) - the badge only actually varies for combined events, where a Heptathlon result can
// legally count toward a Decathlon ranking (and vice versa) as a "Similar Event".
function normEvt(s){return String(s||'').toLowerCase().replace(/kilometres?|kilometers?/g,'km').replace(/metres?|meters?/g,'m').replace(/hurdles?/g,'h').replace(/steeplechase/g,'sc').replace(/[^a-z0-9]+/g,'');}
const eventAliases={'100m':['100m'],'200m':['200m'],'400m':['400m'],'800m':['800m'],'1500m':['1500m'],'5000m':['5000m'],'10000m':['10000m'],'100mH':['100mh'],'110mH':['110mh'],'400mH':['400mh'],'3000mSC':['3000msc'],HJ:['highjump'],PV:['polevault'],LJ:['longjump'],TJ:['triplejump'],SP:['shotput'],DT:['discusthrow'],HT:['hammerthrow'],JT:['javelinthrow'],Decathlon:['decathlon'],Heptathlon:['heptathlon']};
function exactMatchEvt(discipline,code){const n=normEvt(discipline);return (eventAliases[code]||[]).some(a=>{if(n===a)return true;if(!n.startsWith(a))return false;const rest=n.slice(a.length);return rest!=='h'&&rest!=='sc';});}
// WA's ranking rules group each Main Event with one or more "Similar Events" that also count
// toward the same ranking - confirmed directly from WA's own world-rankings page titles (not
// guessed): "Men's 110mH (50mH-55mH-60mH)", "Men's 400m (300m-500m)", "Men's 800m (600m-1000m)",
// "Men's 1500m (Mile-2000m-Mile Road)", "Men's 3000mSC (2000mSC)", "Men's 5000m (3000m-2 Miles-
// 5km)", "Women's 10000m (10km)". Plain 200m, 400mH, and every jump/throw have no parenthetical
// on their own page titles - no Similar Events for those. The road-distance variants (Mile Road,
// 5km, 10km) are a best-effort match on normalized text; not yet confirmed against the exact raw
// discipline string this endpoint returns for those specific cases (see debug-raw-basis.js).
const similarEventAliases={
  '100m':['50m','55m','60m'],
  '100mH':['50mh','55mh','60mh'],
  '110mH':['50mh','55mh','60mh'],
  '400m':['300m','500m'],
  '800m':['600m','1000m'],
  '1500m':['mile','2000m'],
  '3000mSC':['2000msc'],
  '5000m':['3000m','2miles','5km'],
  '10000m':['10km']
};
function eventTypeOf(discipline,code){const n=normEvt(discipline);if(code==='Decathlon'){if(n.startsWith('decathlon'))return'main';if(n.startsWith('heptathlon'))return'similar';return null;}if(code==='Heptathlon'){if(n.startsWith('heptathlon'))return'main';if(n.startsWith('pentathlon'))return'similar';return null;}if(exactMatchEvt(discipline,code))return'main';return (similarEventAliases[code]||[]).some(a=>n===a||n.startsWith(a))?'similar':null;}
function typeBadge(t){if(t==='similar')return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#16273a;color:#aebed0;white-space:nowrap">Similar Event</span>';if(t==='main')return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#0d2b22;color:#45d483;white-space:nowrap">Main Event</span>';return '–';}
function basisHtml(data,heading){const rows=Array.isArray(data?.basis)?data.basis:[];if(!rows.length)return `<div class="muted">Offisiell Ranking Score er hentet, men WA leverte ikke detaljert rankinggrunnlag i dette oppslaget.</div>`;return `<div><strong>Tellende rankinggrunnlag i ${esc(heading)} fra World Athletics:</strong><div style="overflow-x:auto;margin-top:7px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px">Dato</th><th style="text-align:left;padding:6px">Stevne</th><th style="text-align:left;padding:6px">Kat.</th><th style="text-align:left;padding:6px">Resultat</th><th style="text-align:right;padding:6px">Result Score</th><th style="text-align:right;padding:6px">Placing Score</th><th style="text-align:right;padding:6px">Performance Score</th><th style="text-align:left;padding:6px">Type</th></tr></thead><tbody>${rows.map(r=>`<tr style="border-top:1px solid #21405f"><td style="padding:6px">${fmtDate(r.date)}</td><td style="padding:6px">${esc(r.competition||'–')}</td><td style="padding:6px">${esc(r.category||'–')}</td><td style="padding:6px">${esc(r.result??r.mark??'–')}</td><td style="padding:6px;text-align:right">${r.resultScore??'–'}</td><td style="padding:6px;text-align:right">${r.placingScore??'–'}</td><td style="padding:6px;text-align:right;font-weight:700">${r.performanceScore??'–'}</td><td style="padding:6px">${typeBadge(eventTypeOf(r.discipline,data.event))}</td></tr>`).join('')}</tbody></table></div></div>`;}
function render(data){
  const score=Number(data.score),heading=label();
  const rank=Number(data.rank),hasWorldRank=data.rankScope==='world'&&Number.isFinite(rank)&&rank>0;
  const rankLine=hasWorldRank?`<div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:6px">#${rank} i verden</div>`:'';
  mount.style.display='block';
  mount.innerHTML=`<div style="display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:18px;align-items:stretch"><div>${basisHtml(data,heading)}</div><div style="background:#102a47;border:1px solid #21405f;border-radius:14px;padding:22px 18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><div style="font-size:13px;letter-spacing:.12em;font-weight:900;color:#ff8a19">OFFISIELL WA RANKING SCORE</div><div style="font-size:52px;line-height:1;font-weight:900;color:#fff;margin:14px 0 10px">${score}</div>${rankLine}</div></div>`;
  window.__rankingstevnerOfficialRanking={event:eventSelect.value,score,rank:hasWorldRank?rank:null,basis:Array.isArray(data.basis)?data.basis:[],source:'World Athletics official ranking calculation'};
  window.__rankingstevnerOfficialPending=false;
  window.dispatchEvent(new CustomEvent('rankingofficialloaded'));
}
async function fetchOnce(id,seq){const res=await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(id)}&event=${encodeURIComponent(eventSelect.value)}&sex=${encodeURIComponent(sex.value)}&v=222&t=${Date.now()}`,{cache:'no-store'}),data=await res.json();if(seq!==requestSeq)return null;return data;}
async function load(){ensureSexSpecificHurdle();const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';if(!id){
  // Bumping requestSeq here too - not just when there's a real id to look up - matters because
  // clearing the WA-ID while an EARLIER lookup is still in flight (its own retries can take a
  // couple seconds) used to leave that in-flight request's captured seq still matching the
  // current one, so its (stale, previous-athlete) result would land AFTER this reset and
  // silently repopulate the box - looking like the reset needed a second click to actually stick.
  ++requestSeq;window.__rankingstevnerOfficialPending=false;mount.style.display='none';mount.innerHTML='';return;
}const seq=++requestSeq;window.__rankingstevnerOfficialPending=true;renderLoading();for(let a=0;a<3;a++){try{const d=await fetchOnce(id,seq);if(seq!==requestSeq)return;if(d?.ok&&d?.verifiedPublished===true&&validScore(d?.score)){render(d);return;}}catch(_){}if(a<2)await new Promise(r=>setTimeout(r,350*(a+1)));}if(seq===requestSeq)renderNone();}
eventSelect.addEventListener('change',()=>setTimeout(load,80));sex.addEventListener('change',()=>{setTimeout(()=>{ensureSexSpecificHurdle();load();},120);});waInput.addEventListener('change',()=>setTimeout(load,20));
// Selecting an athlete from the search dropdown sets the WA-ID directly (no 'change' event) and
// instead relies on this observer reacting to waStatus's text - but athlete-profile.js's own
// lookup sets that text TWICE for the same athlete ("Søker …" then "Koblet til World Athletics"),
// and this used to treat every mutation as "the athlete changed", restarting load() from scratch
// each time. The second restart abandoned whatever the first one was doing mid-flight - wasted
// work, and the visible ranking box kept "loading" far longer than a single lookup needs. Only
// treating an actually-different WA-ID as a real trigger fixes that.
let lastObservedId='';
if(waStatus)new MutationObserver(()=>{
  const id=waInput.value.trim().match(/(\d{7,9})/)?.[1]||'';
  if(!id){lastObservedId='';return;}
  if(id===lastObservedId)return;
  lastObservedId=id;
  setTimeout(()=>{ensureSexSpecificHurdle();load();},60);
}).observe(waStatus,{childList:true,subtree:true,characterData:true});
setTimeout(()=>{ensureSexSpecificHurdle();load();},500);})();
