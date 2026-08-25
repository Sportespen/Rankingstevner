// Rankingstevner v0.16.9 – numerisk resultatfelt + tydelig eksempeltekst
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const technical = new Set(['HJ','PV','LJ','TJ','SP','DT','HT','JT']);
  const longRace = new Set(['800m','1500m','5000m','10000m','3000mSC']);
  const combined = new Set(['Decathlon','Heptathlon']);

  function formatDigits(code, digits) {
    if (!digits) return '';
    if (combined.has(code)) return digits;
    if (technical.has(code)) {
      if (digits.length <= 2) return `0,${digits.padStart(2, '0')}`;
      return `${Number(digits.slice(0, -2))},${digits.slice(-2)}`;
    }
    if (longRace.has(code)) {
      if (digits.length <= 2) return `0:00,${digits.padStart(2, '0')}`;
      if (digits.length <= 4) {
        const padded = digits.padStart(4, '0');
        return `0:${padded.slice(0, 2)},${padded.slice(2)}`;
      }
      return `${Number(digits.slice(0, -4))}:${digits.slice(-4, -2)},${digits.slice(-2)}`;
    }
    if (digits.length <= 2) return `0,${digits.padStart(2, '0')}`;
    return `${Number(digits.slice(0, -2))},${digits.slice(-2)}`;
  }

  function placeholderFor(code) {
    if (combined.has(code)) return 'f.eks. 8200';
    if (technical.has(code)) return code === 'HJ' || code === 'PV' ? '215 → 2,15' : '785 → 7,85';
    if (longRace.has(code)) return code === '800m' ? '14520 → 1:45,20' : '132456 → 13:24,56';
    return '1032 → 10,32';
  }

  function hintFor(code) {
    if (combined.has(code)) return 'Skriv bare poengsummen med tall, f.eks. 8200.';
    if (technical.has(code)) return 'Skriv bare tall. De to siste sifrene blir centimeter.';
    if (longRace.has(code)) return 'Skriv bare tall. De fire siste sifrene blir sekunder og hundredeler.';
    return 'Skriv bare tall. De to siste sifrene blir hundredeler.';
  }

  function initResultField() {
    const event = $('event');
    const editor = $('safeResultEditor');
    const hint = $('safeResultHint');
    const mark = $('mark');
    if (!event || !editor || !hint || !mark) { setTimeout(initResultField, 100); return; }
    let activeCode = null;

    function publish(value) {
      mark.value = value;
      mark.dispatchEvent(new Event('input', { bubbles: true }));
      mark.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function build(code) {
      editor.replaceChildren();
      editor.style.cssText = 'display:flex;align-items:center;width:100%;height:48px;min-height:48px;margin-top:7px';
      publish('');
      const input = document.createElement('input');
      input.id = 'resultDigits';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.autocomplete = 'off';
      input.placeholder = placeholderFor(code);
      input.setAttribute('aria-label', 'Resultat, kun tall');
      input.style.cssText = 'display:block;width:100%;height:48px;min-height:48px;margin:0;padding:0 14px;border:1px solid #c9d5dc;border-radius:12px;background:#fff;font-size:1.05rem;font-weight:700;box-sizing:border-box';
      input.addEventListener('input', () => {
        const rawDigits = input.value.replace(/\D/g, '').slice(0, combined.has(code) ? 5 : 7);
        const formatted = formatDigits(code, rawDigits);
        input.value = formatted;
        publish(formatted);
      });
      input.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End','Enter'];
        if (allowed.includes(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      });
      editor.append(input);
      hint.textContent = hintFor(code);
    }

    function buildWaiting() {
      editor.replaceChildren();
      editor.style.cssText = 'display:flex;align-items:center;width:100%;height:48px;min-height:48px;margin-top:7px';
      const input = document.createElement('input');
      input.type = 'text'; input.disabled = true; input.placeholder = 'Velg øvelse først';
      input.style.cssText = 'display:block;width:100%;height:48px;min-height:48px;margin:0;padding:0 14px;border:1px solid #c9d5dc;border-radius:12px;background:#fff;font-size:1.05rem;font-weight:700;box-sizing:border-box;opacity:.7';
      editor.append(input);
      hint.textContent = 'Resultatformatet bestemmes automatisk av valgt øvelse.';
      publish('');
    }

    function rebuild(force = false) {
      const code = event.value || '';
      if (!code) { activeCode = ''; buildWaiting(); return; }
      if (!force && code === activeCode && editor.children.length) return;
      activeCode = code; build(code);
    }

    event.addEventListener('change', () => rebuild(true));
    new MutationObserver(() => rebuild(true)).observe(event, { childList: true, subtree: true });
    rebuild(true);
    setTimeout(() => rebuild(true), 300);
    setTimeout(() => rebuild(true), 800);
    setInterval(() => { const code = event.value || ''; if (code !== activeCode || !editor.children.length) rebuild(true); }, 500);
  }

  function initDeferredWind() {
    const originalWind = $('wind'), calculate = $('calculate'), resultScore = $('resultScore'), windAdjustment = $('windAdjustment'), event = $('event'), mark = $('mark');
    if (!originalWind || !calculate || !resultScore || !windAdjustment || !event || !mark) { setTimeout(initDeferredWind, 100); return; }
    if ($('windVisible')) return;
    const visibleWind = originalWind.cloneNode(true); visibleWind.id = 'windVisible'; originalWind.style.display = 'none'; originalWind.parentNode.insertBefore(visibleWind, originalWind);
    function parseWindLocal(raw) { const s=String(raw).trim().toUpperCase().replace(',','.'); if(!s)return null; if(s==='NWI')return'NWI'; const v=Number(s); return Number.isFinite(v)?v:null; }
    function windModLocal(raw) { const w=parseWindLocal(raw); if(w===null)return null;if(w==='NWI')return-30;if(w<0)return Math.abs(w)*6;if(w>2)return-w*6;return 0; }
    function fmt(v){return Number.isInteger(v)?String(v):v.toFixed(1).replace('.',',');}
    function updateWindDisplayOnly(){originalWind.value=visibleWind.value;const mod=windModLocal(visibleWind.value);windAdjustment.value=mod===null?'–':`${mod>0?'+':''}${fmt(mod)}`;}
    function recalcBaseWithoutWind(){const savedWind=originalWind.value;originalWind.value='';try{if(typeof refreshResultScore==='function')refreshResultScore();}finally{originalWind.value=savedWind;}}
    visibleWind.addEventListener('input',updateWindDisplayOnly); visibleWind.addEventListener('change',updateWindDisplayOnly);
    event.addEventListener('change',()=>{visibleWind.value='';originalWind.value='';});
    mark.addEventListener('input',recalcBaseWithoutWind); mark.addEventListener('change',recalcBaseWithoutWind);
    calculate.addEventListener('click',()=>{originalWind.value=visibleWind.value;setTimeout(()=>{try{if(typeof adjustedResultDetails!=='function')return;const details=adjustedResultDetails();if(!details)return;const adjusted=details.adjusted;resultScore.value=Number.isInteger(adjusted)?String(adjusted):String(adjusted).replace('.',',');resultScore.dispatchEvent(new Event('input',{bubbles:true}));resultScore.dispatchEvent(new Event('change',{bubbles:true}));}catch(err){console.error('Kunne ikke synkronisere justert score etter beregning',err);}},0);});
    updateWindDisplayOnly();
  }

  function boot(){initResultField();initDeferredWind();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();