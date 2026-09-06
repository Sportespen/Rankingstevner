// Rankingstevner v0.13.5 – vindfelt som resultatfelt: 24 vises som 2,4
(() => {
'use strict';
function init(){
const originalWind=document.getElementById('wind'),calculate=document.getElementById('calculate'),resultScore=document.getElementById('resultScore'),windAdjustment=document.getElementById('windAdjustment'),event=document.getElementById('event'),category=document.getElementById('category'),placing=document.getElementById('placing'),mark=document.getElementById('mark');
if(!originalWind||!calculate||!resultScore||!windAdjustment||!event||!category||!placing||!mark){setTimeout(init,100);return}if(document.getElementById('windControl'))return;originalWind.style.display='none';
const wrap=document.createElement('div');wrap.id='windControl';wrap.style.cssText='margin-top:7px';
// Standardvalget skal være "ingen vindpåvirkning" - de aller fleste resultater trenger ingen
// vindjustering, og å tvinge et valg for hvert resultat var akkurat det brukeren ba om å fjerne.
// En enkel, tydelig av/på-bryter (samme visuelle språk som mangekamp sin vindstatus-nedtrekksmeny,
// bare enda mer synlig) erstatter den tidligere alltid-synlige +/-/NWI-raden, som så ut som noe du
// MÅTTE fylle ut selv om appen aldri faktisk krevde det.
const toggleWrap=document.createElement('div');toggleWrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
const toggleBtns={};
[['off','Ingen vindpåvirkning'],['on','Vind påvirket resultatet']].forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.textContent=l;b.style.cssText='flex:1;min-width:150px;border:1px solid #3f6b92;border-radius:11px;background:#0d2743;color:#f4f7fb;font-weight:800;font-size:13.5px;padding:10px 12px;cursor:pointer';toggleBtns[v]=b;toggleWrap.appendChild(b)});
const detailsWrap=document.createElement('div');detailsWrap.style.cssText='display:none;grid-template-columns:auto minmax(120px,1fr);gap:8px;margin-top:8px;align-items:stretch';
const signWrap=document.createElement('div');signWrap.style.cssText='display:flex;gap:6px';let selectedSign='';const buttons={};
[['+','+','Medvind'],['-','−','Motvind'],['NWI','NWI','Ukjent']].forEach(([v,l,caption])=>{const col=document.createElement('div');col.style.cssText='display:flex;flex-direction:column;align-items:center;gap:3px';const b=document.createElement('button');b.type='button';b.textContent=l;b.style.cssText='min-width:54px;border:1px solid #3f6b92;border-radius:11px;background:#0d2743;color:#f4f7fb;font-weight:800;font-size:16px;padding:0 12px;cursor:pointer';b.onclick=()=>{selectedSign=v;Object.entries(buttons).forEach(([k,x])=>{const a=k===v;x.style.background=a?'#ff8a19':'#0d2743';x.style.color=a?'#061426':'#f4f7fb';x.style.borderColor=a?'#ff8a19':'#3f6b92'});if(v==='NWI'){amount.value='';amount.dataset.digits=''}amount.disabled=v==='NWI';sync()};buttons[v]=b;const cap=document.createElement('small');cap.textContent=caption;cap.style.cssText='color:#aebed0;font-size:10.5px;font-weight:600;white-space:nowrap';col.append(b,cap);signWrap.appendChild(col)});
const amount=document.createElement('input');amount.id='windAmount';amount.type='text';amount.inputMode='numeric';amount.autocomplete='off';amount.placeholder='f.eks. 2,4';amount.style.marginTop='0';amount.dataset.digits='';
originalWind.parentNode.insertBefore(wrap,originalWind);wrap.append(toggleWrap,detailsWrap);detailsWrap.append(signWrap,amount);
let windMatters=false;
const windAdjustmentHint=document.getElementById('windAdjustmentHint');
const HINT_OFF='Gjelder når vinden er mellom 0 og +2,0 m/s medvind - ingen justering da.';
const HINT_ON='Motvind gir tillegg, sterk medvind gir trekk.';
const HINT_NWI='Ukjent vind (NWI) gir -30 poeng i trekk.';
function updateHint(){if(!windAdjustmentHint)return;windAdjustmentHint.textContent=!windMatters?HINT_OFF:(selectedSign==='NWI'?HINT_NWI:HINT_ON)}
function paintToggle(){Object.entries(toggleBtns).forEach(([k,b])=>{const a=(k==='on')===windMatters;b.style.background=a?'#ff8a19':'#0d2743';b.style.color=a?'#061426':'#f4f7fb';b.style.borderColor=a?'#ff8a19':'#3f6b92'});detailsWrap.style.display=windMatters?'grid':'none';updateHint()}
toggleBtns.off.onclick=()=>{windMatters=false;selectedSign='';Object.values(buttons).forEach(b=>{b.style.background='#0d2743';b.style.color='#f4f7fb';b.style.borderColor='#3f6b92'});amount.dataset.digits='';amount.value='';amount.disabled=false;paintToggle();sync()};
toggleBtns.on.onclick=()=>{windMatters=true;paintToggle();sync()};
paintToggle();
// Ett siffer er alltid det hele tallet (",0" underforstått), andre siffer blir tidelsdelen - "1"
// skal altså bli 1,0 m/s med en gang, ikke 0,1 m/s uten komma vist (som så ut som et helt annet
// tall enn det faktisk betydde).
function format(d){if(!d)return'';if(d.length===1)return d[0]+',0';return d[0]+','+d[1]}
function value(){const d=amount.dataset.digits||'';if(!d)return null;return d.length===1?Number(d[0]):Number(d[0])+Number(d[1])/10}
function raw(){if(!windMatters)return'';if(selectedSign==='NWI')return'NWI';const n=value();if(!selectedSign||n===null)return'';return selectedSign+n.toFixed(1).replace('.',',')}
function windMod(r){const s=String(r).replace(',','.');if(!s)return null;if(s==='NWI')return-30;const w=Number(s);if(!Number.isFinite(w))return null;if(w<0)return Math.abs(w)*6;if(w>2)return-w*6;return 0}
function fmt(v){return Number.isInteger(v)?String(v):v.toFixed(1).replace('.',',')}
function sync(){amount.value=format(amount.dataset.digits||'');originalWind.value=raw();const m=windMod(originalWind.value);windAdjustment.value=m===null?'0':`${m>0?'+':''}${fmt(m)}`;updateHint()}
window.__rankingstevnerSyncWind=sync;
// Sifrene spores direkte her, ikke ved å tolke dem tilbake fra den kommaformaterte visningen
// (f.eks. "1,0") - den visningen inneholder et syntetisk "0" som ikke er et reelt tastet siffer,
// og å lese sifre ut av den igjen ville mistet det andre reelle sifferet brukeren taster inn.
amount.addEventListener('beforeinput',e=>{e.preventDefault();if(e.inputType==='insertText'&&e.data&&/^\d$/.test(e.data)){amount.dataset.digits=((amount.dataset.digits||'')+e.data).slice(0,2);sync()}});
amount.addEventListener('keydown',e=>{if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();amount.dataset.digits=(amount.dataset.digits||'').slice(0,-1);sync()}});
// Bare et faktisk øvelsesbytte skal nullstille vindvalget til standard "Ingen vindpåvirkning" -
// "Nullstill"-knappen (trinn3.js) dispatcher også en 'change' på #event selv når øvelsen er
// UENDRET, bare for å trigge andre lyttere. Å nullstille vindbryteren på den synteiske hendelsen
// også ville gjeninnført akkurat det brukeren ba om å fjerne - måtte velge vind på nytt for hvert
// nye resultat. Sammenligner mot forrige faktiske verdi for å skille de to tilfellene.
let lastEventValue=event.value;
event.addEventListener('change',()=>{if(event.value===lastEventValue)return;lastEventValue=event.value;windMatters=false;selectedSign='';Object.values(buttons).forEach(b=>{b.style.background='#0d2743';b.style.color='#f4f7fb';b.style.borderColor='#3f6b92'});amount.dataset.digits='';amount.value='';amount.disabled=false;paintToggle();originalWind.value='';windAdjustment.value='0'});
function recalcBase(){const saved=originalWind.value;originalWind.value='';try{if(typeof refreshResultScore==='function')refreshResultScore()}finally{originalWind.value=saved;sync()}}
mark.addEventListener('input',recalcBase);mark.addEventListener('change',recalcBase);category.addEventListener('change',recalcBase);placing.addEventListener('change',recalcBase);
calculate.addEventListener('click',()=>setTimeout(()=>{try{if(typeof adjustedResultDetails!=='function')return;const d=adjustedResultDetails();if(!d)return;const a=d.adjusted;resultScore.value=Number.isInteger(a)?String(a):String(a).replace('.',',');resultScore.dispatchEvent(new Event('input',{bubbles:true}));resultScore.dispatchEvent(new Event('change',{bubbles:true}))}catch(err){console.error(err)}},0));sync();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(() => {
  function loadFastAthleteSearch(){
    if(document.querySelector('script[data-fast-athlete-search-v0184]')) return;
    const s=document.createElement('script');
    s.src='athlete-search-fast.js?v=0184';
    s.dataset.fastAthleteSearchV0184='1';
    document.head.appendChild(s);
  }
  setTimeout(loadFastAthleteSearch,0);
})();

// Legacy stevnefinner.js (v0.19) used to be loaded here alongside meet-finder-v1.js,
// which fought over the same #meetList/section-head DOM. Its only feature meet-finder-v1.js
// lacked (contact/prize lookup) has been ported into meet-finder-v1.js; the file is removed.

(() => {
  function loadRankingEventMatchFix(){
    if(document.querySelector('script[data-ranking-event-match-fix-v0191]')) return;
    const s=document.createElement('script');
    s.src='ranking-event-match-fix.js?v=0191';
    s.dataset.rankingEventMatchFixV0191='1';
    document.head.appendChild(s);
  }
  setTimeout(loadRankingEventMatchFix,0);
})();

(() => {
  function loadRankingEffectWaFix(){
    if(document.querySelector('script[data-ranking-effect-wa-fix-v0223]')) return;
    const s=document.createElement('script');
    s.src='ranking-effect-wa-fix.js?v=0223';
    s.dataset.rankingEffectWaFixV0223='1';
    document.head.appendChild(s);
  }
  setTimeout(loadRankingEffectWaFix,0);
})();
