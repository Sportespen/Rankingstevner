// Rankingstevner v0.12.6 – vind påvirker først scorekortene ved klikk på Beregn rankingeffekt
(() => {
  'use strict';

  function init() {
    const originalWind = document.getElementById('wind');
    const calculate = document.getElementById('calculate');
    const resultScore = document.getElementById('resultScore');
    const resultMirror = document.getElementById('resultScoreMirror');
    const placingPreview = document.getElementById('placingScorePreview');
    const performancePreview = document.getElementById('performanceScorePreview');
    const windAdjustment = document.getElementById('windAdjustment');
    const event = document.getElementById('event');
    const category = document.getElementById('category');
    const placing = document.getElementById('placing');
    const mark = document.getElementById('mark');

    if (!originalWind || !calculate || !resultScore || !resultMirror || !placingPreview || !performancePreview || !windAdjustment || !event || !category || !placing || !mark) {
      setTimeout(init, 100);
      return;
    }

    const visibleWind = originalWind.cloneNode(true);
    visibleWind.id = 'windVisible';
    originalWind.style.display = 'none';
    originalWind.parentNode.insertBefore(visibleWind, originalWind);

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
      originalWind.value = visibleWind.value;
      const mod = windModLocal(visibleWind.value);
      windAdjustment.value = mod === null ? '–' : `${mod > 0 ? '+' : ''}${fmt(mod)}`;
    }

    visibleWind.addEventListener('input', updateWindDisplayOnly);
    visibleWind.addEventListener('change', updateWindDisplayOnly);

    event.addEventListener('change', () => {
      visibleWind.value = '';
      originalWind.value = '';
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

    // Kjør synkront etter app.js sin mark-listener. Da er basis-score satt før Trinn 3 leser den.
    mark.addEventListener('input', recalcBaseWithoutWind);
    mark.addEventListener('change', recalcBaseWithoutWind);
    category.addEventListener('change', recalcBaseWithoutWind);
    placing.addEventListener('change', recalcBaseWithoutWind);

    calculate.addEventListener('click', () => {
      originalWind.value = visibleWind.value;
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
