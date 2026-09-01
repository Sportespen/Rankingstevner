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
// Same descriptions as meet-finder-v1.js's own category badges - duplicated (small, static data)
// rather than exposed, same reasoning as placementFor()/TRACK_EVENTS below.
const CATEGORY_DESCRIPTIONS = {
  OW: 'Olympiske leker / VM - høyeste stevnekategori',
  DF: 'Diamond League-finale',
  GW: 'Diamond League (ordinær runde)',
  GL: 'Gold Label / Continental Tour Gold - store internasjonale stevner',
  A: 'Continental Tour Silver-nivå - høyt internasjonalt stevne',
  B: 'Continental Tour Bronse-nivå - solid internasjonalt/nasjonalt stevne',
  C: 'Mindre internasjonalt eller stort nasjonalt stevne',
  D: 'Nasjonalt/regionalt stevne',
  E: 'Mindre regionalt stevne',
  F: 'Lokalt/klubbstevne - laveste stevnekategori'
};
// OW/DF/GW (Olympics/VM, Diamond League final, Diamond League) are invite-only for the world's
// established elite - live feedback caught this box recommending a Diamond League final to an
// athlete ranked #3532 in the world, something they have no realistic path into regardless of what
// the Performance Score math says. Recommending only from categories a developing/regional athlete
// can actually get into (national federation entry, standard qualifying times, direct contact to
// the organiser) also sidesteps the closed-tiny-field problem that only really shows up at the
// elite invite-only tiers: a meet nobody outside a small invited field can enter at all shouldn't
// be recommended no matter how good the estimated placing looks. Left GL out too, out of caution -
// Gold Label/Continental Tour Gold meets are still a strong, largely invited field in practice.
const ACCESSIBLE_CATEGORIES = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
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
  // it anyway, since they're normally the same underlying list). Capped at 10 (was 20) after live
  // feedback that the box was too slow - each probed meet can take several seconds through the
  // shared 3-at-a-time queue, so halving the pool roughly halves the worst-case wait.
  const pool = finder.currentMatches()
    .filter(m => m.id && m.name && m.start && ACCESSIBLE_CATEGORIES.has(String(m.rankingCategory || '').trim()))
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 10);

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

// Exact copy of meet-finder-v1.js's own locationText() - the API sometimes returns location as a
// plain string, sometimes as an object ({venue,city,country,countryCode,area}), and a version that
// only handled the string shape silently fell back to "Sted ikke publisert" for every meet using
// the object shape, even though the card below (using the real function) showed a real location.
function locationText(m){
  const loc = m?.location;
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object') return [loc.venue, loc.city, loc.country, loc.countryCode, loc.area].filter(Boolean).join(' ');
  return String(loc);
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
  // Clicking the card jumps down to the same meet's own full card (contact info, program,
  // "Historisk nivå" details) further down the page instead of duplicating all of that here.
  return `<div data-jump-to-meet="${esc(x.meet.id)}" style="padding:14px 16px;border:1px solid #cfe2dc;border-radius:12px;background:#fff;cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div><strong>${esc(x.meet.name || 'Stevne')}</strong><div class="muted" style="font-size:12px;margin-top:2px">${esc(locationText(x.meet) || 'Sted ikke publisert')} · ${fmtDate(x.meet.start)}</div></div>
      <span class="cat" title="${esc(CATEGORY_DESCRIPTIONS[x.category]||'')}">${esc(x.category)}</span>
    </div>
    <small style="display:block;margin-top:8px">Forventet ${ordinal(x.place)} plass med din beste tellende prestasjon → <strong>Performance Score ${x.performanceScore}</strong> (Result Score ${x.resultScore} + Placing Score ${x.placingScore})${sourceLink}</small>
    ${improvementLine}
    <small class="muted" style="display:block;margin-top:8px">Trykk for å se hele stevnekortet ↓</small>
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
// ranking-basis.js (window.RankingstevnerScoring) loads via a three-hop chain (target-score.js
// schedules official-ranking.js, which only injects ranking-basis.js once ITS OWN script has
// finished loading) - confirmed live twice now that this can take longer than expected, or
// possibly not resolve at all in a given page load. A capped retry (tried once already, 20x500ms)
// still left the box permanently blank when that chain took longer than the cap - there's no real
// cost to checking a few object references, so 'not-ready' now retries indefinitely on a gentle
// cadence instead of giving up. Genuinely nothing to show (no WA-ID, no candidates found) still
// renders an explanatory message via the other `reason` branches below - only 'not-ready' (the
// scripts themselves not being loaded yet) keeps trying forever.
let everRendered = false;
async function recompute(){
  const box = document.getElementById('rankingRecommendations');
  if (!box) return;
  // Shown once, immediately, so the box isn't an invisible blank space while the scripts this
  // depends on are still loading (which, per the comment above, can take a little while) - live
  // evidence showed users reading "nothing there" as the module being broken rather than loading.
  if (!everRendered && !box.innerHTML) {
    box.innerHTML = `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box"><span class="eyebrow">ANBEFALTE STEVNER</span><p class="muted" style="margin:8px 0 0">Beregner anbefalinger …</p></div>`;
  }
  const myRun = ++runId;
  if (computing) return; // a newer trigger will run right after this one finishes anyway
  computing = true;
  try {
    const result = await computeRecommendations();
    if (myRun !== runId) return; // event/sex changed again while this was in flight
    if (result?.reason === 'not-ready') {
      scheduleRecompute(1000);
      return; // leave the loading state (or whatever was already showing) rather than blanking it
    }
    everRendered = true;
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

// Scrolls to and briefly highlights the same meet's own full card further down the page (contact
// info, program, "Historisk nivå" details) instead of duplicating all of that inside this box.
// Delegated on document (not the box itself) so it survives the box's innerHTML being replaced on
// every recompute - meet-finder-v1.js now stamps data-meet-id on each card for this to match on.
function jumpToMeet(id){
  if (!id) return;
  const card = document.querySelector(`.meet-card-v1[data-meet-id="${CSS.escape(String(id))}"]`);
  if (!card) return; // e.g. filtered out by the date/country/venue filters above - nothing to jump to
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.style.transition = 'outline-color .3s ease';
  card.style.outline = '3px solid #0f766e';
  card.style.outlineOffset = '2px';
  setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 1800);
}
document.addEventListener('click', e => {
  const item = e.target.closest('[data-jump-to-meet]');
  if (!item || e.target.closest('a')) return; // let the "Historisk nivå" link open normally
  jumpToMeet(item.dataset.jumpToMeet);
});

document.addEventListener('DOMContentLoaded', () => {
  scheduleRecompute(300);
  // Delayed a bit more than before (50ms -> 500ms) so the visible cards' own history fetches
  // (meet-history-ui.js's apply(), triggered by this same event) get a head start claiming the
  // shared queue/cache first - since this box's own probe pool normally overlaps heavily with the
  // visible cards, letting cards go first means more of this box's own lookups arrive as instant
  // cache hits instead of adding a second, competing burst of fresh queue entries on top.
  window.addEventListener('meetlistrendered', () => scheduleRecompute(500));
  // The athlete's own PB, current Ranking Score, and the scoring tables all become available via
  // this same event (ranking-basis.js) - a second trigger for cases where the box's first attempt
  // ran before any of that was ready and no event/sex change happens afterward to prompt a retry.
  window.addEventListener('rankingbasisupdated', () => scheduleRecompute(300));
  document.getElementById('event')?.addEventListener('change', () => scheduleRecompute(600));
  document.getElementById('sex')?.addEventListener('change', () => scheduleRecompute(700));
});
})();
