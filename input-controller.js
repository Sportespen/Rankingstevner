// Rankingstevner v0.13.5 – vindfelt som resultatfelt: 24 vises som 2,4
(() => {
'use strict';
function init(){
const originalWind=document.getElementById('wind'),calculate=document.getElementById('calculate'),resultScore=document.getElementById('resultScore'),windAdjustment=document.getElementById('windAdjustment'),event=document.getElementById('event'),category=document.getElementById('category'),placing=document.getElementById('placing'),mark=document.getElementById('mark');
if(!originalWind||!calculate||!resultScore||!windAdjustment||!event||!category||!placing||!mark){setTimeout(init,100);return}if(document.getElementById('windControl'))return;originalWind.style.display='none';
const wrap=document.createElement('div');wrap.id='windControl';wrap.style.cssText='display:grid;grid-template-columns:auto minmax(120px,1fr);gap:8px;margin-top:7px;align-items:stretch';const signWrap=document.createElement('div');signWrap.style.cssText='display:flex;gap:6px';let selectedSign='';const buttons={};
[['+','+'],['-','−'],['NWI','NWI']].forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.textContent=l;b.style.cssText='min-width:54px;border:1px solid #cfd7de;border-radius:11px;background:#fff;color:#14202b;font-weight:800;font-size:16px;padding:0 12px;cursor:pointer';b.onclick=()=>{selectedSign=v;Object.entries(buttons).forEach(([k,x])=>{const a=k===v;x.style.background=a?'#0f766e':'#fff';x.style.color=a?'#fff':'#14202b';x.style.borderColor=a?'#0f766e':'#cfd7de'});if(v==='NWI'){amount.value='';amount.dataset.digits=''}amount.disabled=v==='NWI';sync()};buttons[v]=b;signWrap.appendChild(b)});
const amount=document.createElement('input');amount.id='windAmount';amount.type='text';amount.inputMode='numeric';amount.autocomplete='off';amount.placeholder='f.eks. 2,4';amount.style.marginTop='0';amount.dataset.digits='';originalWind.parentNode.insertBefore(wrap,originalWind);wrap.append(signWrap,amount);
function format(d){if(!d)return'';if(d.length===1)return d;if(d.length===2)return d[0]+','+d[1];return d.slice(0,-1)+','+d.slice(-1)}
function value(){const d=amount.dataset.digits||'';if(!d)return null;return Number(d)/10}
function raw(){if(selectedSign==='NWI')return'NWI';const n=value();if(!selectedSign||n===null)return'';return selectedSign+n.toFixed(1).replace('.',',')}
function windMod(r){const s=String(r).replace(',','.');if(!s)return null;if(s==='NWI')return-30;const w=Number(s);if(!Number.isFinite(w))return null;if(w<0)return Math.abs(w)*6;if(w>2)return-w*6;return 0}
function fmt(v){return Number.isInteger(v)?String(v):v.toFixed(1).replace('.',',')}
function sync(){amount.value=format(amount.dataset.digits||'');originalWind.value=raw();const m=windMod(originalWind.value);windAdjustment.value=m===null?'–':`${m>0?'+':''}${fmt(m)}`}
amount.addEventListener('beforeinput',e=>{if(e.inputType==='insertText'&&e.data&&/\D/.test(e.data))e.preventDefault()});
amount.addEventListener('input',()=>{const incoming=amount.value.replace(/\D/g,'');amount.dataset.digits=incoming.slice(0,2);sync()});
amount.addEventListener('keydown',e=>{if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();amount.dataset.digits=(amount.dataset.digits||'').slice(0,-1);sync()}});
event.addEventListener('change',()=>{selectedSign='';Object.values(buttons).forEach(b=>{b.style.background='#fff';b.style.color='#14202b';b.style.borderColor='#cfd7de'});amount.dataset.digits='';amount.value='';amount.disabled=false;originalWind.value='';windAdjustment.value='–'});
function recalcBase(){const saved=originalWind.value;originalWind.value='';try{if(typeof refreshResultScore==='function')refreshResultScore()}finally{originalWind.value=saved}}
mark.addEventListener('input',recalcBase);mark.addEventListener('change',recalcBase);category.addEventListener('change',recalcBase);placing.addEventListener('change',recalcBase);
calculate.addEventListener('click',e=>{if(originalWind.closest('#windSection')?.style.display!=='none'){if(!selectedSign){e.preventDefault();e.stopImmediatePropagation();alert('Velg + for medvind, − for motvind eller NWI før du beregner.');return}if(selectedSign!=='NWI'&&!amount.dataset.digits){e.preventDefault();e.stopImmediatePropagation();alert('Skriv vindstyrken. Du trenger ikke skrive komma.');amount.focus()}}},true);
calculate.addEventListener('click',()=>setTimeout(()=>{try{if(typeof adjustedResultDetails!=='function')return;const d=adjustedResultDetails();if(!d)return;const a=d.adjusted;resultScore.value=Number.isInteger(a)?String(a):String(a).replace('.',',');resultScore.dispatchEvent(new Event('input',{bubbles:true}));resultScore.dispatchEvent(new Event('change',{bubbles:true}))}catch(err){console.error(err)}},0));sync();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(() => {
  function loadFastAthleteSearch(){
    if(document.querySelector('script[data-fast-athlete-search-v0180]')) return;
    const s=document.createElement('script');
    s.src='athlete-search-fast.js?v=0180';
    s.dataset.fastAthleteSearchV0180='1';
    document.head.appendChild(s);
  }
  setTimeout(loadFastAthleteSearch,0);
})();
