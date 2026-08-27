// Rankingstevner v0.17.0 – numerisk resultatfelt + kjønnstilpassede realistiske eksempler
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const technical = new Set(['HJ','PV','LJ','TJ','SP','DT','HT','JT']);
  const longRace = new Set(['800m','1500m','5000m','10000m','3000mSC']);
  const combined = new Set(['Decathlon','Heptathlon']);

  const examples = {
    M: {
      '100m':'1032 → 10,32','200m':'2040 → 20,40','400m':'4520 → 45,20','800m':'14520 → 1:45,20',
      '1500m':'33500 → 3:35,00','5000m':'132456 → 13:24,56','10000m':'275000 → 27:50,00',
      '110mH':'1320 → 13,20','400mH':'4800 → 48,00','3000mSC':'82000 → 8:20,00',
      'HJ':'215 → 2,15','PV':'550 → 5,50','LJ':'785 → 7,85','TJ':'1650 → 16,50',
      'SP':'2000 → 20,00','DT':'6500 → 65,00','HT':'7800 → 78,00','JT':'8200 → 82,00',
      'Decathlon':'f.eks. 8200'
    },
    W: {
      '100m':'1120 → 11,20','200m':'2300 → 23,00','400m':'5200 → 52,00','800m':'20000 → 2:00,00',
      '1500m':'40000 → 4:00,00','5000m':'150000 → 15:00,00','10000m':'310000 → 31:00,00',
      '100mH':'1260 → 12,60','400mH':'5400 → 54,00','3000mSC':'93000 → 9:30,00',
      'HJ':'195 → 1,95','PV':'460 → 4,60','LJ':'680 → 6,80','TJ':'1450 → 14,50',
      'SP':'1900 → 19,00','DT':'6500 → 65,00','HT':'7500 → 75,00','JT':'6500 → 65,00',
      'Heptathlon':'f.eks. 6500'
    }
  };

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

  function placeholderFor(code, athleteSex) {
    const sexExamples = examples[athleteSex] || examples.M;
    if (sexExamples[code]) return sexExamples[code];
    if (combined.has(code)) return athleteSex === 'W' ? 'f.eks. 6500' : 'f.eks. 8200';
    if (technical.has(code)) return code === 'HJ' || code === 'PV' ? (athleteSex === 'W' ? '195 → 1,95' : '215 → 2,15') : (athleteSex === 'W' ? '680 → 6,80' : '785 → 7,85');
    if (longRace.has(code)) return athleteSex === 'W' ? '20000 → 2:00,00' : '14520 → 1:45,20';
    return athleteSex === 'W' ? '1120 → 11,20' : '1032 → 10,32';
  }

  function hintFor(code, athleteSex) {
    if (combined.has(code)) return '';
    if (technical.has(code)) return 'Skriv bare tall. De to siste sifrene blir centimeter.';
    if (longRace.has(code)) return 'Skriv bare tall. De fire siste sifrene blir sekunder og hundredeler.';
    return 'Skriv bare tall. De to siste sifrene blir hundredeler.';
  }

  function initResultField() {
    const event = $('event');
    const sex = $('sex');
    const editor = $('safeResultEditor');
    const hint = $('safeResultHint');
    const mark = $('mark');
    if (!event || !sex || !editor || !hint || !mark) { setTimeout(initResultField, 100); return; }
    let activeKey = null;

    function publish(value) {
      mark.value = value;
      mark.dispatchEvent(new Event('input', { bubbles: true }));
      mark.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function build(code) {
      const athleteSex = sex.value || 'M';
      editor.replaceChildren();
      editor.style.cssText = 'display:flex;align-items:center;width:100%;height:48px;min-height:48px;margin-top:7px';
      publish('');
      const input = document.createElement('input');
      input.id = 'resultDigits';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.autocomplete = 'off';
      input.placeholder = placeholderFor(code, athleteSex);
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
      hint.textContent = hintFor(code, athleteSex);
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
      const key = `${sex.value || 'M'}:${code}`;
      if (!code) { activeKey = key; buildWaiting(); return; }
      if (!force && key === activeKey && editor.children.length) return;
      activeKey = key;
      build(code);
    }

    event.addEventListener('change', () => rebuild(true));
    sex.addEventListener('change', () => setTimeout(() => rebuild(true), 0));
    new MutationObserver(() => rebuild(true)).observe(event, { childList: true, subtree: true });
    rebuild(true);
    setTimeout(() => rebuild(true), 300);
    setTimeout(() => rebuild(true), 800);
    setInterval(() => {
      const key = `${sex.value || 'M'}:${event.value || ''}`;
      if (key !== activeKey || !editor.children.length) rebuild(true);
    }, 500);
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