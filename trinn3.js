// Rankingstevner Trinn 3 v0.12.0 – eventstyrt implementasjon bygget på nytt
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const placingTables = {
    standard:{OW:[260,230,210,190,175,160,150,140,91,84,77,70,66,63,60,57],DF:[170,150,130,120,110,100,95,90,63,56,49,42],GW:[140,120,110,100,90,80,75,70,49,42,35,32],GL:[120,105,95,85,75,70,65,60,42,35,31,28],A:[100,84,77,70,63,56,49,42,35,31,27,24],B:[70,56,49,42,38,34,30,27,24,21,18,15],C:[42,35,31,28,25,22,19,16,14,12,10,8],D:[28,24,21,18,15,13,12,11],E:[18,15,13,11,9,7],F:[11,7,4]},
    distance:{OW:[215,190,170,155,140,130],DF:[130,115,100,87,80,73],GW:[115,95,85,77,70,63],GL:[95,85,77,70,63,56],A:[70,63,56,49,42,35],B:[50,42,35,31,27,24],C:[35,28,24,21,18,16],D:[25,19,15,13,11,9],E:[14,11,9,8,7,6],F:[8,5,3]},
    tenk:{OW:[200,175,160,145,130,120,110,100],DF:[125,105,95,85,75,67,60,53],GW:[100,85,75,65,56,49,42,35],GL:[80,65,55,46,39,35,31,28],A:[56,49,42,35,31,27,24,21],B:[42,35,31,27,24,21,18,15],C:[32,27,22,18,15,13,12,11],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]},
    combined:{OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],DF:[125,105,95,85,75,67,60,53,35,28,24,21],GW:[100,85,75,65,56,49,42,35,25,21,17,13],GL:[80,65,55,46,39,35,31,28,21,17,14,11],A:[56,49,42,35,31,27,24,21,15,13,11,9],B:[42,35,31,27,24,21,18,15,13,11,9,8],C:[32,27,22,18,15,13,12,11,10,9,8,7],D:[21,15,13,11,10,9,8,7],E:[14,10,7,6,5,4],F:[7,4,2]}
  };

  const technical = new Set(['HJ','PV','LJ','TJ','SP','DT','HT','JT']);
  const longRace = new Set(['800m','1500m','5000m','10000m','3000mSC']);
  const combined = new Set(['Decathlon','Heptathlon']);

  const eventLabels = {
    '100m':'100 m','200m':'200 m','400m':'400 m','800m':'800 m','1500m':'1500 m',
    '5000m':'5000 m','10000m':'10 000 m','100mH':'100 m hekk','110mH':'110 m hekk',
    '400mH':'400 m hekk','3000mSC':'3000 m hinder','HJ':'Høyde','PV':'Stav','LJ':'Lengde',
    'TJ':'Tresteg','SP':'Kule','DT':'Diskos','HT':'Slegge','JT':'Spyd',
    'Decathlon':'Tikamp','Heptathlon':'Sjukamp'
  };

  function groupFor(code) {
    if (code === '5000m' || code === '3000mSC') return 'distance';
    if (code === '10000m') return 'tenk';
    if (combined.has(code)) return 'combined';
    return 'standard';
  }

  function init() {
    const event = $('event');
    const editor = $('safeResultEditor');
    const hint = $('safeResultHint');
    const mark = $('mark');
    const resultScore = $('resultScore');
    const category = $('category');
    const placing = $('placing');
    const resultOut = $('resultScoreMirror');
    const placingOut = $('placingScorePreview');
    const performanceOut = $('performanceScorePreview');
    const heading = document.querySelector('.trinn3-heading');
    const help = document.querySelector('.trinn3-help');
    const calculate = $('calculate');

    if (![event, editor, hint, mark, resultScore, category, placing, resultOut, placingOut, performanceOut].every(Boolean)) {
      setTimeout(init, 100);
      return;
    }

    let activeEvent = '';
    let scoreUpdateTimer = null;

    function placingArray() {
      return placingTables[groupFor(event.value)]?.[category.value] || [];
    }

    function getPlacingScore() {
      const arr = placingArray();
      const pos = Number(placing.value || 0);
      if (!pos || pos < 1) return null;
      return arr[pos - 1] ?? null;
    }

    function rebuildPlacingOptions(preservePosition = true) {
      const old = preservePosition ? Number(placing.value || 1) : 1;
      const arr = placingArray();
      placing.innerHTML = arr.map((_, i) => `<option value="${i + 1}">${i + 1}. plass</option>`).join('');
      const next = Math.min(Math.max(old, 1), Math.max(arr.length, 1));
      if (arr.length) placing.value = String(next);
    }

    function updateScoreCards() {
      const raw = String(resultScore.value || '').trim().replace(',', '.');
      const rs = Number(raw);
      const ps = getPlacingScore();
      const validResult = raw !== '' && Number.isFinite(rs);
      resultOut.textContent = validResult ? String(Math.round(rs)) : '–';
      placingOut.textContent = ps == null ? '–' : String(ps);
      performanceOut.textContent = validResult && ps != null ? String(Math.round(rs + ps)) : '–';
    }

    function scheduleScoreUpdate() {
      clearTimeout(scoreUpdateTimer);
      updateScoreCards();
      scoreUpdateTimer = setTimeout(updateScoreCards, 80);
    }

    function setMark(value) {
      mark.value = value;
      mark.dispatchEvent(new Event('input', { bubbles: true }));
      scheduleScoreUpdate();
    }

    function field({placeholder, maxLength, max, width = 92}) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.placeholder = placeholder;
      input.maxLength = maxLength;
      input.setAttribute('aria-label', placeholder);
      input.style.cssText = `width:${width}px;min-height:54px;padding:10px 12px;border:1px solid #cfd9df;border-radius:12px;background:#fff;font-size:1.25rem;font-weight:800;text-align:center`;
      input.addEventListener('input', () => {
        let v = input.value.replace(/\D/g, '').slice(0, maxLength);
        if (v !== '' && max != null && Number(v) > max) v = String(max);
        input.value = v;
      });
      return input;
    }

    function token(text) {
      const el = document.createElement('span');
      el.textContent = text;
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'font-size:1.2rem;font-weight:800;color:#526170';
      return el;
    }

    function resetEditor() {
      editor.replaceChildren();
      editor.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:58px;margin-top:4px';
      hint.textContent = '';
      setMark('');
    }

    function buildSprint(code) {
      resetEditor();
      const maxSec = {100m:30,200m:60,400m:120,100mH:40,110mH:40,400mH:120}[code] ?? 120;
      const sec = field({placeholder:'sek', maxLength:maxSec >= 100 ? 3 : 2, max:maxSec, width:105});
      const hundredths = field({placeholder:'00', maxLength:2, max:99, width:76});
      const sync = () => {
        if (sec.value === '' || hundredths.value === '') return setMark('');
        setMark(`${Number(sec.value)},${String(Number(hundredths.value)).padStart(2,'0')}`);
      };
      sec.addEventListener('input', sync);
      hundredths.addEventListener('input', sync);
      editor.append(sec, token(','), hundredths, token('sek'));
      hint.textContent = 'Skriv sekunder og hundredeler. Komma settes inn automatisk.';
      setTimeout(() => sec.focus(), 0);
    }

    function buildLongRace(code) {
      resetEditor();
      const maxMin = {800m:9,1500m:14,3000mSC:30,5000m:60,10000m:120}[code] ?? 120;
      const min = field({placeholder:'min', maxLength:maxMin >= 100 ? 3 : 2, max:maxMin, width:92});
      const sec = field({placeholder:'sek', maxLength:2, max:59, width:82});
      const hundredths = field({placeholder:'00', maxLength:2, max:99, width:72});
      const sync = () => {
        if ([min,sec,hundredths].some((el) => el.value === '')) return setMark('');
        setMark(`${Number(min.value)}:${String(Number(sec.value)).padStart(2,'0')},${String(Number(hundredths.value)).padStart(2,'0')}`);
      };
      [min,sec,hundredths].forEach((el) => el.addEventListener('input', sync));
      editor.append(min, token(':'), sec, token(','), hundredths, token('min:sek'));
      hint.textContent = 'Skriv minutter, sekunder og hundredeler i hvert sitt felt.';
      setTimeout(() => min.focus(), 0);
    }

    function buildTechnical(code) {
      resetEditor();
      const maxM = {HJ:3,PV:7,LJ:10,TJ:20,SP:30,DT:100,HT:100,JT:120}[code] ?? 120;
      const metres = field({placeholder:'m', maxLength:maxM >= 100 ? 3 : 2, max:maxM, width:95});
      const centimetres = field({placeholder:'cm', maxLength:2, max:99, width:76});
      const sync = () => {
        if (metres.value === '' || centimetres.value === '') return setMark('');
        setMark(`${Number(metres.value)},${String(Number(centimetres.value)).padStart(2,'0')}`);
      };
      metres.addEventListener('input', sync);
      centimetres.addEventListener('input', sync);
      editor.append(metres, token(','), centimetres, token('m'));
      hint.textContent = 'Skriv meter og centimeter i hvert sitt felt.';
      setTimeout(() => metres.focus(), 0);
    }

    function buildCombined(code) {
      resetEditor();
      const points = field({placeholder:'poeng', maxLength:5, max:code === 'Heptathlon' ? 9000 : 12000, width:170});
      points.addEventListener('input', () => setMark(points.value));
      editor.append(points, token('poeng'));
      hint.textContent = 'Skriv samlet poengsum.';
      setTimeout(() => points.focus(), 0);
    }

    function updateText(code) {
      const label = eventLabels[code] || event.options[event.selectedIndex]?.text || 'valgt øvelse';
      if (heading) heading.textContent = `Test et nytt rankingresultat – ${label}`;
      if (help) help.textContent = `Legg inn resultatet du tror du kan oppnå i ${label}, velg stevnekategori og plassering. Result Score, Placing Score og Performance Score vises fortløpende.`;
    }

    function rebuildForEvent(force = false) {
      const code = event.value;
      if (!code) return;
      if (!force && code === activeEvent && editor.children.length) return;
      activeEvent = code;
      updateText(code);
      rebuildPlacingOptions(false);
      if (combined.has(code)) buildCombined(code);
      else if (technical.has(code)) buildTechnical(code);
      else if (longRace.has(code)) buildLongRace(code);
      else buildSprint(code);
      scheduleScoreUpdate();
    }

    event.addEventListener('change', () => rebuildForEvent(true));
    category.addEventListener('change', () => {
      rebuildPlacingOptions(false);
      scheduleScoreUpdate();
    });
    placing.addEventListener('change', scheduleScoreUpdate);
    resultScore.addEventListener('input', scheduleScoreUpdate);
    resultScore.addEventListener('change', scheduleScoreUpdate);

    new MutationObserver(() => {
      if (event.value && event.value !== activeEvent) rebuildForEvent(true);
    }).observe(event, {childList:true});

    new MutationObserver(scheduleScoreUpdate).observe(placing, {childList:true});

    if (calculate) {
      calculate.addEventListener('click', () => setTimeout(scheduleScoreUpdate, 0));
    }

    rebuildForEvent(true);
    setTimeout(() => rebuildForEvent(true), 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
