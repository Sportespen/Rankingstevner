// Rankingstevner v0.12.6 – ett numerisk resultatfelt med automatisk øvelsesformat
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
        const minutes = Number(digits.slice(0, -4));
        const seconds = digits.slice(-4, -2);
        const hundredths = digits.slice(-2);
        return `${minutes}:${seconds},${hundredths}`;
      }

      // Sprint/hekk: de to siste sifrene er hundredeler.
      if (digits.length <= 2) return `0,${digits.padStart(2, '0')}`;
      return `${Number(digits.slice(0, -2))},${digits.slice(-2)}`;
    }

    function placeholderFor(code) {
      if (combined.has(code)) return '8200';
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

    function build(code) {
      editor.replaceChildren();
      editor.style.cssText = 'display:flex;align-items:center;min-height:62px;margin-top:8px';
      publish('');

      const input = document.createElement('input');
      input.id = 'resultDigits';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.autocomplete = 'off';
      input.placeholder = placeholderFor(code);
      input.setAttribute('aria-label', 'Resultat, kun tall');
      input.style.cssText = 'width:100%;height:56px;padding:0 14px;border:1px solid #c9d5dc;border-radius:12px;background:#fff;font-size:1.25rem;font-weight:800;box-sizing:border-box';

      let rawDigits = '';
      input.addEventListener('input', () => {
        rawDigits = input.value.replace(/\D/g, '').slice(0, combined.has(code) ? 5 : 7);
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
      const input = document.createElement('input');
      input.type = 'text';
      input.disabled = true;
      input.placeholder = 'Velg øvelse først';
      input.style.cssText = 'width:100%;height:56px;padding:0 14px;border:1px solid #c9d5dc;border-radius:12px;background:#fff;font-size:1.1rem;font-weight:700;box-sizing:border-box;opacity:.7';
      editor.append(input);
      hint.textContent = 'Resultatformatet bestemmes automatisk av valgt øvelse.';
      publish('');
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
      build(code);
    }

    event.addEventListener('change', () => rebuild(true));
    new MutationObserver(() => rebuild(true)).observe(event, { childList: true, subtree: true });

    rebuild(true);
    setTimeout(() => rebuild(true), 300);
    setTimeout(() => rebuild(true), 800);
    setInterval(() => {
      const code = event.value || '';
      if (code !== activeCode || !editor.children.length) rebuild(true);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
