// Rankingstevner v0.12.1 – selvstendig resultatfelt for Trinn 3
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const technical = new Set(['HJ','PV','LJ','TJ','SP','DT','HT','JT']);
  const longRace = new Set(['800m','1500m','5000m','10000m','3000mSC']);
  const combined = new Set(['Decathlon','Heptathlon']);

  function init() {
    const event = $('event');
    const editor = $('safeResultEditor');
    const hint = $('safeResultHint');
    const mark = $('mark');
    if (!event || !editor || !hint || !mark) {
      setTimeout(init, 100);
      return;
    }

    let activeCode = null;

    function publish(value) {
      mark.value = value;
      mark.dispatchEvent(new Event('input', { bubbles: true }));
      mark.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function inputField(placeholder, maxLength, max, width = 100) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.placeholder = placeholder;
      input.maxLength = maxLength;
      input.style.cssText = `width:${width}px;height:56px;padding:0 14px;border:1px solid #c9d5dc;border-radius:12px;background:#fff;font-size:1.25rem;font-weight:800;text-align:center;box-sizing:border-box`;
      input.addEventListener('input', () => {
        let value = input.value.replace(/\D/g, '').slice(0, maxLength);
        if (value !== '' && max != null && Number(value) > max) value = String(max);
        input.value = value;
      });
      return input;
    }

    function separator(text) {
      const span = document.createElement('span');
      span.textContent = text;
      span.style.cssText = 'font-size:1.25rem;font-weight:800;color:#516171';
      return span;
    }

    function clear() {
      editor.replaceChildren();
      editor.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:62px;margin-top:8px';
      hint.textContent = '';
      publish('');
    }

    function buildSprint(code) {
      clear();
      const maxSeconds = {100m:30,200m:60,400m:120,100mH:40,110mH:40,400mH:120}[code] || 120;
      const sec = inputField('sek', maxSeconds >= 100 ? 3 : 2, maxSeconds, 112);
      const hun = inputField('00', 2, 99, 82);
      const sync = () => {
        if (!sec.value || !hun.value) return publish('');
        publish(`${Number(sec.value)},${String(Number(hun.value)).padStart(2,'0')}`);
      };
      sec.addEventListener('input', sync);
      hun.addEventListener('input', sync);
      editor.append(sec, separator(','), hun, separator('sek'));
      hint.textContent = 'Sekunder og hundredeler – skriv bare tall.';
    }

    function buildLongRace(code) {
      clear();
      const maxMinutes = {800m:9,1500m:14,3000mSC:30,5000m:60,10000m:120}[code] || 120;
      const min = inputField('min', maxMinutes >= 100 ? 3 : 2, maxMinutes, 100);
      const sec = inputField('sek', 2, 59, 88);
      const hun = inputField('00', 2, 99, 82);
      const sync = () => {
        if (!min.value || !sec.value || !hun.value) return publish('');
        publish(`${Number(min.value)}:${String(Number(sec.value)).padStart(2,'0')},${String(Number(hun.value)).padStart(2,'0')}`);
      };
      [min, sec, hun].forEach(el => el.addEventListener('input', sync));
      editor.append(min, separator(':'), sec, separator(','), hun, separator('min:sek'));
      hint.textContent = 'Minutter, sekunder og hundredeler – skriv bare tall.';
    }

    function buildTechnical(code) {
      clear();
      const maxMetres = {HJ:3,PV:7,LJ:10,TJ:20,SP:30,DT:100,HT:100,JT:120}[code] || 120;
      const metres = inputField('m', maxMetres >= 100 ? 3 : 2, maxMetres, 100);
      const centimetres = inputField('cm', 2, 99, 88);
      const sync = () => {
        if (!metres.value || !centimetres.value) return publish('');
        publish(`${Number(metres.value)},${String(Number(centimetres.value)).padStart(2,'0')}`);
      };
      metres.addEventListener('input', sync);
      centimetres.addEventListener('input', sync);
      editor.append(metres, separator(','), centimetres, separator('m'));
      hint.textContent = 'Meter og centimeter – skriv bare tall.';
    }

    function buildCombined(code) {
      clear();
      const points = inputField('poeng', 5, code === 'Heptathlon' ? 9000 : 12000, 180);
      points.addEventListener('input', () => publish(points.value));
      editor.append(points, separator('poeng'));
      hint.textContent = 'Skriv samlet poengsum.';
    }

    function buildWaiting() {
      clear();
      const waiting = inputField('Velg øvelse først', 1, 0, 220);
      waiting.disabled = true;
      waiting.style.opacity = '0.7';
      editor.append(waiting);
      hint.textContent = 'Resultatfeltet tilpasses automatisk til valgt øvelse.';
    }

    function rebuild(force = false) {
      const code = event.value || '';
      if (!code) {
        activeCode = '';
        buildWaiting();
        return;
      }
      if (!force && code === activeCode && editor.children.length) return;
      activeCode = code;
      if (combined.has(code)) buildCombined(code);
      else if (technical.has(code)) buildTechnical(code);
      else if (longRace.has(code)) buildLongRace(code);
      else buildSprint(code);
    }

    event.addEventListener('change', () => rebuild(true));
    new MutationObserver(() => rebuild(true)).observe(event, { childList: true, subtree: true });

    rebuild(true);
    setTimeout(() => rebuild(true), 300);
    setTimeout(() => rebuild(true), 800);

    // Sikkerhetsnett dersom et annet script senere endrer øvelseslisten.
    setInterval(() => {
      const code = event.value || '';
      if (code !== activeCode || !editor.children.length) rebuild(true);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
