// Anbefalte stevner - de 3 stevnene i valgt øvelse der utøveren har best sjanse til å forbedre sin
// ranking: en kombinasjon av høy stevnekategori (gir høyere Placing Score-bonus for samme
// plassering) og lavt historisk nivå (svakere felt gir bedre forventet plassering med egen PB) -
// nøyaktig den kombinasjonen som faktisk avgjør Performance Score (= Result Score + Placing Score)
// i WA sitt eget rankingsystem. Gjenbruker byggeklossene resten av appen allerede har og har
// verifisert (Result Score-tabeller og Placing Score-tabeller fra ranking-basis.js, egen PB fra
// window.__rankingstevnerOwnResults, historisk feltstyrke fra meet-history.js sin "Historisk
// nivå"-pipeline, stevnelisten fra meet-finder-v1.js) i stedet for en egen, potensielt
// inkonsistent beregning.
(() => {
'use strict';

function esc(s){ return String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function eventCode(){ return document.getElementById('event')?.value || ''; }
function athleteSex(){ return document.getElementById('sex')?.value === 'W' ? 'W' : 'M'; }
function isCombinedCode(event){ return event === 'Decathlon' || event === 'Heptathlon'; }

// Same "which direction is better" list meet-history.js already uses for the green comparison
// line - lower time wins for track events, higher mark wins for jumps/throws/combined events.
const TRACK_EVENTS = new Set(['100m', '200m', '400m', '800m', '1500m', '5000m', '10000m', '100mH', '110mH', '400mH', '3000mSC']);
function isAscending(event){ return TRACK_EVENTS.has(event); }

// Same placement-estimate logic as meet-history.js's green comparison line, duplicated here
// (rather than exposed and imported) since it's a tiny, self-contained 8-line function - not worth
// a cross-file API just for this.
function placementFor(allMarks, mark, ascending){
  if (!Array.isArray(allMarks) || !allMarks.length || !Number.isFinite(mark)) return null;
  if (ascending) {
    if (mark > Math.max(...allMarks)) return null;
    return allMarks.filter(m => m < mark).length + 1;
  }
  if (mark < Math.min(...allMarks)) return null;
  return allMarks.filter(m => m > mark).length + 1;
}

// Athlete's own best mark for the selected event, same source (and same 'main'-type-only rule) as
// meet-history.js's bestOwnMark() - the indoor 'similar' substitute marks (e.g. 60m for 100m)
// aren't a fair comparison against an outdoor field's marks, so only real same-distance marks count.
function ownBestMark(event){
  const own = window.__rankingstevnerOwnResults;
  if (!own || own.event !== event) return null;
  const marks = (Array.isArray(own.rows) ? own.rows : []).filter(r => r.type === 'main').map(r => Number(r.mark)).filter(Number.isFinite);
  if (!marks.length) return null;
  return isAscending(event) ? Math.min(...marks) : Math.max(...marks);
}

function ordinal(n){ return `${n}.`; }

async function computeRecommendations(){
  const finder = window.RankingstevnerMeetFinder;
  const history = window.RankingstevnerMeetHistory;
  const scoring = window.RankingstevnerScoring;
  if (!finder || !history || !scoring) return { reason: 'not-ready' };

  const event = eventCode();
  if (!event) return { reason: 'no-event' };

  await history.waitForOwnResults();
  const pb = ownBestMark(event);
  if (pb == null) return { reason: 'no-own-mark' };

  await scoring.ready();
  const ascending = isAscending(event);
  const resultScore = scoring.resultScore(event, pb);
  if (resultScore == null) return { reason: 'no-result-score' };

  // Sorted soonest-first before capping - a nearer-term meet is more actionable than one over a
  // year out, and this keeps the number of fresh lookups this box can trigger bounded regardless
  // of how many meets match overall (most will already be cache hits from the visible cards below
  // it anyway, since they're normally the same underlying list).
  const pool = finder.currentMatches()
    .filter(m => m.id && m.name && m.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 20);

  const currentRankingScore = scoring.currentRankingScore();

  const results = await Promise.all(pool.map(async m => {
    const category = String(m.rankingCategory || '').trim();
    if (!category) return null;
    const data = await history.dataAsync(m.name, m.start);
    if (!data?.found || data.comparable === false || !Array.isArray(data.allMarks) || !data.allMarks.length) return null;
    const place = placementFor(data.allMarks, pb, ascending);
    if (place == null) return null;
    const placingScore = scoring.placingScore(event, category, place);
    if (placingScore == null) return null;
    return {
      meet: m, place, category,
      resultScore, placingScore,
      performanceScore: resultScore + placingScore,
      year: data.year || null,
      source: data.source || null,
    };
  }));

  const scored = results.filter(Boolean).sort((a, b) => b.performanceScore - a.performanceScore);
  return { pb, resultScore, currentRankingScore, probed: pool.length, top: scored.slice(0, 3) };
}

function locationText(m){
  const raw = typeof m?.location === 'string' ? m.location : '';
  return raw.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim();
}
function fmtDate(v){
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function itemHtml(x){
  const improvement = Number.isFinite(x.improvement) ? x.improvement : null;
  const improvementLine = improvement != null
    ? (improvement > 0
        ? `<small style="display:block;color:#087f5b;font-weight:700">+${improvement} poeng mot din nåværende Ranking Score.</small>`
        : `<small style="display:block;color:#677585">${improvement} poeng mot din nåværende Ranking Score - fortsatt en sterk Performance Score, men ikke en forbedring akkurat nå.</small>`)
    : '';
  const yearBit = x.year ? ` (${x.year})` : '';
  const sourceLink = x.source ? ` · <a href="${esc(x.source)}" target="_blank" rel="noopener">Historisk nivå${yearBit}</a>` : '';
  return `<div style="padding:14px 16px;border:1px solid #cfe2dc;border-radius:12px;background:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div><strong>${esc(x.meet.name || 'Stevne')}</strong><div class="muted" style="font-size:12px;margin-top:2px">${esc(locationText(x.meet) || 'Sted ikke publisert')} · ${fmtDate(x.meet.start)}</div></div>
      <span class="cat">${esc(x.category)}</span>
    </div>
    <small style="display:block;margin-top:8px">Forventet ${ordinal(x.place)} plass med din beste tellende prestasjon → <strong>Performance Score ${x.performanceScore}</strong> (Result Score ${x.resultScore} + Placing Score ${x.placingScore})${sourceLink}</small>
    ${improvementLine}
  </div>`;
}

function renderHtml(result){
  const heading = `<span class="eyebrow">ANBEFALTE STEVNER</span>`;
  if (!result || result.reason === 'not-ready' || result.reason === 'no-event') return '';
  if (result.reason === 'no-own-mark') {
    return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box">${heading}<p class="muted" style="margin:8px 0 0">Fyll inn WA-ID med et registrert resultat i valgt øvelse for å få stevneanbefalinger basert på ditt eget nivå.</p></div>`;
  }
  if (result.reason === 'no-result-score') {
    return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box">${heading}<p class="muted" style="margin:8px 0 0">Fant ikke Result Score for din beste prestasjon i valgt øvelse ennå.</p></div>`;
  }
  const currentLine = Number.isFinite(result.currentRankingScore) ? ` Din nåværende Ranking Score: <strong>${result.currentRankingScore}</strong>.` : '';
  if (!result.top || !result.top.length) {
    return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box">${heading}<p class="muted" style="margin:8px 0 0">Fant ingen stevner med nok verifisert historisk nivå ennå til å gi konkrete anbefalinger (så langt sjekket ${result.probed} stevner).${currentLine}</p></div>`;
  }
  const items = result.top.map(x => ({ ...x, improvement: Number.isFinite(result.currentRankingScore) ? x.performanceScore - result.currentRankingScore : null }));
  return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box">
    ${heading}
    <p class="muted" style="margin:8px 0 12px">Stevner der høy stevnekategori og et historisk sett svakt felt gir best mulighet til å forbedre rankingen din, basert på din beste tellende prestasjon (${formatOwnMark(result)}).${currentLine}</p>
    <div style="display:grid;gap:10px">${items.map(itemHtml).join('')}</div>
  </div>`;
}

// Uses meet-history.js's own formatting (already loaded, same event code conventions) so a time
// looks like "10.72"/"1:45.20" rather than a raw seconds float.
function formatOwnMark(result){
  const fmt = window.RankingstevnerMeetHistory?.formatMark;
  if (typeof fmt === 'function') return fmt(result.pb, eventCode());
  return String(result.pb);
}

let runId = 0;
let computing = false;
// ranking-basis.js (window.RankingstevnerScoring) loads dynamically, well after this file's own
// script tag runs - confirmed live: the box stayed permanently blank because the very first
// attempt ran before that had loaded, got 'not-ready', and nothing ever asked for a second try
// (no event/sex change, no re-render of the meet list). 'not-ready' now retries itself on a short
// backoff instead of relying on an unrelated trigger to happen to fire again - capped so a
// genuinely broken page doesn't retry forever.
let notReadyRetries = 0;
async function recompute(){
  const box = document.getElementById('rankingRecommendations');
  if (!box) return;
  const myRun = ++runId;
  if (computing) return; // a newer trigger will run right after this one finishes anyway
  computing = true;
  try {
    const result = await computeRecommendations();
    if (myRun !== runId) return; // event/sex changed again while this was in flight
    if (result?.reason === 'not-ready') {
      if (notReadyRetries < 20) { notReadyRetries++; scheduleRecompute(500); }
      return; // leave whatever was showing before (usually nothing yet) rather than blanking it
    }
    notReadyRetries = 0;
    box.innerHTML = renderHtml(result);
  } finally {
    computing = false;
    // If something else asked for a recompute while this one was running, run once more now
    // instead of leaving stale data showing.
    if (myRun !== runId) recompute();
  }
}

let debounceTimer = null;
function scheduleRecompute(delay){
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(recompute, delay);
}

document.addEventListener('DOMContentLoaded', () => {
  scheduleRecompute(300);
  window.addEventListener('meetlistrendered', () => scheduleRecompute(50));
  // The athlete's own PB, current Ranking Score, and the scoring tables all become available via
  // this same event (ranking-basis.js) - a second trigger for cases where the box's first attempt
  // ran before any of that was ready and no event/sex change happens afterward to prompt a retry.
  window.addEventListener('rankingbasisupdated', () => scheduleRecompute(300));
  document.getElementById('event')?.addEventListener('change', () => scheduleRecompute(600));
  document.getElementById('sex')?.addEventListener('change', () => scheduleRecompute(700));
});
})();
