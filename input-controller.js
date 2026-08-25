// Rankingstevner v0.13.0 – eksplisitt + / − / NWI for vind, og vind påvirker score først ved beregning
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

    if (!originalWind || !calculate || !resultScore || !windAdjustment || !event || !category || !placing || !mark) {
      setTimeout(init, 100);
      return;
    }
    if (document.getElementById('windControl')) return;

    // Skjul feltet som beregningsmotoren allerede kjenner.
    originalWind.style.display = 'none';

    // Bombesikker synlig kontroll: fortegn må velges eksplisitt.
    const wrap = document.createElement('div');
    wrap.id = 'windControl';
    wrap.style.cssText = 'display:grid;grid-template-columns:145px minmax(120px,1fr);gap:8px;margin-top:7px';

    const sign = document.createElement('select');
    sign.id = 'windSign';
    sign.setAttribute('aria-label', 'Fortegn for vind');
    sign.style.marginTop = '0';
    sign.innerHTML = '<option value="">Velg + / −</option><option value="+">+ medvind</option><option value="-">− motvind</option><option value="NWI">NWI</option>';

    const amount = document.createElement('input');
    amount.id = 'windAmount';
    amount.type = 'text';
    amount.inputMode = 'decimal';
    amount.autocomplete = 'off';
    amount.placeholder = 'f.eks. 2,4';
    amount.style.marginTop = '0';

    originalWind.parentNode.insertBefore(wrap, originalWind);
    wrap.append(sign, amount);

    function sanitizeAmount() {
      let v = amount.value.replace('.', ',').replace(/[^0-9,]/g, '');
      const parts = v.split(',');
      if (parts.length > 2) v = `${parts.shift()},${parts.join('')}`;
      if (v.includes(',')) {
        const [a,b=''] = v.split(',');
        v = `${a.slice(0,2)},${b.slice(0,1)}`;
      } else {
        v = v.slice(0,2);
      }
      amount.value = v;
    }

    function composedWind() {
      if (sign.value === 'NWI') return 'NWI';
      if ((sign.value !== '+' && sign.value !== '-') || !amount.value) return '';
      const n = Number(amount.value.replace(',', '.'));
      if (!Number.isFinite(n)) return '';
      return `${sign.value}${n.toFixed(1).replace('.', ',')}`;
    }

    function parseWindLocal(raw) {
      const s = String(raw).trim().toUpperCase().replace(',', '.');
      if (!s) return null;
      if (s === 'NWI') return 'NWI';
      const v = Number(s);
      return Number.isFinite(v) ? v : null;
    }

    function windModLocal(raw) {
      const w = parseWindLocal(raw);
      if (w === null) return null;
      if (w === 'NWI') return -30;
      if (w < 0) return Math.abs(w) * 6;
      if (w > 2) return -w * 6;
      return 0;
    }

    function fmt(v) {
      return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
    }

    function updateWindDisplayOnly() {
      sanitizeAmount();
      const raw = composedWind();
      originalWind.value = raw; // ingen input/change-event -> scorekortene endres ikke nå
      amount.disabled = sign.value === 'NWI';
      if (sign.value === 'NWI') amount.value = '';
      const mod = windModLocal(raw);
      windAdjustment.value = mod === null ? '–' : `${mod > 0 ? '+' : ''}${fmt(mod)}`;
    }

    sign.addEventListener('change', updateWindDisplayOnly);
    amount.addEventListener('input', updateWindDisplayOnly);
    amount.addEventListener('change', updateWindDisplayOnly);

    event.addEventListener('change', () => {
      sign.value = '';
      amount.value = '';
      amount.disabled = false;
      originalWind.value = '';
      windAdjustment.value = '–';
    });

    function recalcBaseWithoutWind() {
      const savedWind = originalWind.value;
      originalWind.value = '';
      try {
        if (typeof refreshResultScore === 'function') refreshResultScore();
      } finally {
        originalWind.value = savedWind;
      }
    }

    mark.addEventListener('input', recalcBaseWithoutWind);
    mark.addEventListener('change', recalcBaseWithoutWind);
    category.addEventListener('change', recalcBaseWithoutWind);
    placing.addEventListener('change', recalcBaseWithoutWind);

    // Stopp beregningen før app.js hvis fortegn/NWI ikke er eksplisitt valgt.
    calculate.addEventListener('click', (e) => {
      if (originalWind.closest('#windSection')?.style.display !== 'none') {
        if (!sign.value) {
          e.preventDefault(); e.stopImmediatePropagation();
          alert('Velg + for medvind, − for motvind eller NWI før du beregner.');
          sign.focus();
          return;
        }
        if (sign.value !== 'NWI' && !amount.value) {
          e.preventDefault(); e.stopImmediatePropagation();
          alert('Skriv vindstyrken etter at du har valgt + eller −.');
          amount.focus();
        }
      }
    }, true);

    // Etter beregning synkroniseres justert score til kortene øverst.
    calculate.addEventListener('click', () => {
      setTimeout(() => {
        try {
          if (typeof adjustedResultDetails !== 'function') return;
          const details = adjustedResultDetails();
          if (!details) return;
          const adjusted = details.adjusted;
          resultScore.value = Number.isInteger(adjusted) ? String(adjusted) : String(adjusted).replace('.', ',');
          resultScore.dispatchEvent(new Event('input', { bubbles: true }));
          resultScore.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {
          console.error('Kunne ikke synkronisere justert score etter beregning', err);
        }
      }, 0);
    });

    updateWindDisplayOnly();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
