// Rankingstevner v0.13.3 – vind: kun ett siffer, automatisk tidel
(() => {
  'use strict';

  function init() {
    const originalWind = document.getElementById('wind');
    const calculate = document.getElementById('calculate');
    const resultScore = document.getElementById('resultScore');
    const windAdjustment = document.getElementById('windAdjustment');
    const event = document.getElementById('event');
    const category = document.getElementById('category');
    const placing = document.getElementById('placing');
    const mark = document.getElementById('mark');
    if (!originalWind || !calculate || !resultScore || !windAdjustment || !event || !category || !placing || !mark) { setTimeout(init,100); return; }
    if (document.getElementById('windControl')) return;
    originalWind.style.display='none';

    const wrap=document.createElement('div'); wrap.id='windControl'; wrap.style.cssText='display:grid;grid-template-columns:auto minmax(120px,1fr);gap:8px;margin-top:7px;align-items:stretch';
    const signWrap=document.createElement('div'); signWrap.id='windSignButtons'; signWrap.style.cssText='display:flex;gap:6px';
    let selectedSign=''; const buttons={};
    [['+','+'],['-','−'],['NWI','NWI']].forEach(([value,label])=>{const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.dataset.value=value;btn.style.cssText='min-width:54px;border:1px solid #cfd7de;border-radius:11px;background:#fff;color:#14202b;font-weight:800;font-size:16px;padding:0 12px;cursor:pointer';btn.addEventListener('click',()=>{selectedSign=value;Object.entries(buttons).forEach(([k,b])=>{const active=k===value;b.style.background=active?'#0f766e':'#fff';b.style.color=active?'#fff':'#14202b';b.style.borderColor=active?'#0f766e':'#cfd7de';});updateWindDisplayOnly();});buttons[value]=btn;signWrap.appendChild(btn);});

    const amount=document.createElement('input'); amount.id='windAmount'; amount.type='text'; amount.inputMode='numeric'; amount.autocomplete='off'; amount.placeholder='f.eks. 24 = 2,4'; amount.maxLength=2; amount.style.marginTop='0';
    originalWind.parentNode.insertBefore(wrap,originalWind); wrap.append(signWrap,amount);

    function sanitizeAmount(){ amount.value=amount.value.replace(/\D/g,'').slice(0,2); }
    function numericWindAmount(){ sanitizeAmount(); if(!amount.value)return null; const n=Number(amount.value)/10; return Number.isFinite(n)&&n<10?n:null; }
    function composedWind(){ if(selectedSign==='NWI')return 'NWI'; if(selectedSign!=='+'&&selectedSign!=='-')return ''; const n=numericWindAmount(); if(n===null)return ''; return `${selectedSign}${n.toFixed(1).replace('.',',')}`; }
    function parseWindLocal(raw){const s=String(raw).trim().toUpperCase().replace(',','.');if(!s)return null;if(s==='NWI')return 'NWI';const v=Number(s);return Number.isFinite(v)?v:null;}
    function windModLocal(raw){const w=parseWindLocal(raw);if(w===null)return null;if(w==='NWI')return -30;if(w<0)return Math.abs(w)*6;if(w>2)return -w*6;return 0;}
    function fmt(v){return Number.isInteger(v)?String(v):v.toFixed(1).replace('.',',');}
    function updateWindDisplayOnly(){sanitizeAmount();const raw=composedWind();originalWind.value=raw;amount.disabled=selectedSign==='NWI';if(selectedSign==='NWI')amount.value='';const mod=windModLocal(raw);windAdjustment.value=mod===null?'–':`${mod>0?'+':''}${fmt(mod)}`;}
    amount.addEventListener('input',updateWindDisplayOnly); amount.addEventListener('change',updateWindDisplayOnly);
    event.addEventListener('change',()=>{selectedSign='';Object.values(buttons).forEach(b=>{b.style.background='#fff';b.style.color='#14202b';b.style.borderColor='#cfd7de';});amount.value='';amount.disabled=false;originalWind.value='';windAdjustment.value='–';});
    function recalcBaseWithoutWind(){const savedWind=originalWind.value;originalWind.value='';try{if(typeof refreshResultScore==='function')refreshResultScore();}finally{originalWind.value=savedWind;}}
    mark.addEventListener('input',recalcBaseWithoutWind);mark.addEventListener('change',recalcBaseWithoutWind);category.addEventListener('change',recalcBaseWithoutWind);placing.addEventListener('change',recalcBaseWithoutWind);
    calculate.addEventListener('click',(e)=>{if(originalWind.closest('#windSection')?.style.display!=='none'){if(!selectedSign){e.preventDefault();e.stopImmediatePropagation();alert('Velg + for medvind, − for motvind eller NWI før du beregner.');buttons['+'].focus();return;}if(selectedSign!=='NWI'&&!amount.value){e.preventDefault();e.stopImmediatePropagation();alert('Skriv vindstyrken med to siffer, for eksempel 24 for 2,4 m/s.');amount.focus();}}},true);
    calculate.addEventListener('click',()=>{setTimeout(()=>{try{if(typeof adjustedResultDetails!=='function')return;const details=adjustedResultDetails();if(!details)return;const adjusted=details.adjusted;resultScore.value=Number.isInteger(adjusted)?String(adjusted):String(adjusted).replace('.',',');resultScore.dispatchEvent(new Event('input',{bubbles:true}));resultScore.dispatchEvent(new Event('change',{bubbles:true}));}catch(err){console.error('Kunne ikke synkronisere justert score etter beregning',err);}},0);});
    updateWindDisplayOnly();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();