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
// be recommended no matter how good the estimated placing looks. GL (Gold Label/Continental Tour
// Gold - e.g. Décastar) was excluded too at first, out of the same caution, but per explicit
// request it's back in: unlike OW/DF/GW it's not reliably a closed invited field in practice.
const ACCESSIBLE_CATEGORIES = new Set(['GL', 'A', 'B', 'C', 'D', 'E', 'F']);
// Highest to lowest, matching meet-finder-v1.js's own RANKING_CATEGORIES order - used to search
// higher categories FIRST. The pool used to sort purely by date, and the search stops as soon as
// it has 3 valid candidates - live feedback caught this settling for 3 F-category meets that
// happened to resolve first chronologically, without the search ever having reached whatever
// A/B/C/D/E meets existed further down the date-sorted list. The whole point of this box is
// finding the HIGHEST category with a low enough field to be realistic, not just "the first 3
// meets that work" - sorting by category rank first (date only as a tie-breaker within the same
// category) means a real A/B/C meet, if one exists and has usable data, gets checked well before
// the search would ever fall back to F.
const CATEGORY_RANK = { GL: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
function eventCode(){ return document.getElementById('event')?.value || ''; }
function eventLabel(){ return document.getElementById('event')?.selectedOptions?.[0]?.textContent || 'valgt øvelse'; }
function athleteSex(){ return document.getElementById('sex')?.value === 'W' ? 'W' : 'M'; }
function isCombinedCode(event){ return event === 'Decathlon' || event === 'Heptathlon'; }
// Matches ranking-basis.js's own validDate() cutoff exactly (18 months for combined events/10000m,
// 12 months for everything else) - shown to the user so "no own mark" reads as a real, understood
// fact about the ranking period rather than a vague "fill in your WA-ID" prompt that's actively
// wrong when a WA-ID IS already filled in and simply has no result for this specific event.
function rankingPeriodMonths(event){ return (isCombinedCode(event) || event === '10000m') ? 18 : 12; }

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
// WA's own API returns a track mark exactly as it displays it - "2:14.73" for anything a minute or
// longer, plain "10.87" under that - not a raw seconds number. A naive Number(r.mark) silently
// produced NaN for every colon-formatted mark, which a plain Number.isFinite filter then dropped -
// so this only ever worked for the events whose marks stay under a minute (100m, 400m, jumps/throws,
// combined-event points), and always found "no own mark" for 800m/1500m/5000m/10000m/steeplechase
// even when the athlete plainly had recent, valid results in period (visible in their own ranking
// grunnlag table above the box).
function parseOwnMark(raw){
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return NaN;
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.some(v => !Number.isFinite(v))) return NaN;
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  return Number(s);
}
function ownBestMark(event){
  const own = window.__rankingstevnerOwnResults;
  if (!own || own.event !== event) return null;
  const marks = (Array.isArray(own.rows) ? own.rows : []).filter(r => r.type === 'main').map(r => parseOwnMark(r.mark)).filter(Number.isFinite);
  if (!marks.length) return null;
  return isAscending(event) ? Math.min(...marks) : Math.max(...marks);
}

function ordinal(n){ return `${n}.`; }

// Checking only the first 10 (highest-category, then soonest) accessible-category meets was fast
// but, per live feedback, often came back empty - not because there was nothing to recommend, just
// because the sample was too small (many meets fail the check for mundane reasons: no confirmed
// historical data yet, or the athlete's own mark falls outside that particular field's known
// range). "No recommendation" should mean genuinely exhausted the real candidates, not "gave up
// after 10". Works through the full list (highest category first, then soonest) in small batches
// instead, stopping as soon as there are 3 good candidates rather than always checking everything
// (still means a higher category gets checked well before ever falling back to a lower one) -
// onProgress lets
// the caller show what's happening while this runs, since it can take a while on a full search.
const BATCH_SIZE = 10;
const POOL_CEILING = 80; // generous but bounded - protects against a pathologically long search

async function computeRecommendations(onProgress){
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
  // scoring.resultScore() (ranking-basis.js's scoreFromTable) only knows the individual-event
  // scoring tables (scoringData[sex][code]) - Decathlon/Heptathlon have no entry there at all, so it
  // always returned null for combined events, even though the athlete plainly HAS a Result Score
  // (shown in their own ranking grunnlag above). combined-ranking-fix.js patches the page-wide
  // window.lookupScoreFor to route Decathlon/Heptathlon through its own combinedScore()
  // (table-or-interpolated-anchors) instead - the same function the "Ny prestasjon" calculator uses
  // for a manually entered combined-event mark. Preferring it here too, with the old path as a
  // fallback in case that patch hasn't loaded for some reason, fixes combined events without
  // duplicating the points->Result Score logic a second time.
  const resultScore = typeof window.lookupScoreFor === 'function'
    ? window.lookupScoreFor(event, pb)
    : scoring.resultScore(event, pb);
  if (resultScore == null) return { reason: 'no-result-score' };

  const candidates = finder.currentMatches()
    .filter(m => m.id && m.name && m.start && ACCESSIBLE_CATEGORIES.has(String(m.rankingCategory || '').trim()))
    .sort((a, b) => {
      const catDiff = CATEGORY_RANK[String(a.rankingCategory || '').trim()] - CATEGORY_RANK[String(b.rankingCategory || '').trim()];
      return catDiff !== 0 ? catDiff : new Date(a.start) - new Date(b.start);
    })
    .slice(0, POOL_CEILING);

  const currentRankingScore = scoring.currentRankingScore();
  let scored = [];
  let checked = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async m => {
      const category = String(m.rankingCategory || '').trim();
      const data = await history.dataAsync(m.name, m.start);
      // Reported per meet, right as each one's (potentially slow, uncached) fetch resolves - not
      // just once per whole batch of 10. A batch-level report left the box showing nothing but the
      // static "Beregner anbefalinger …" for as long as the SLOWEST fetch in the first batch took,
      // which for a busy event (e.g. 100 m) with a cold cache could be the entire wait with zero
      // feedback and no data for the time estimate to work from.
      checked += 1;
      onProgress?.(checked, candidates.length);
      if (!data?.found || data.comparable === false || !Array.isArray(data.allMarks) || !data.allMarks.length) return null;
      let place = placementFor(data.allMarks, pb, ascending);
      let lastPlaceEstimate = false;
      // placementFor() returns null when the athlete's mark is worse than every recorded mark -
      // deliberately, since a WA results page might only publish the top finishers, not the whole
      // field, and claiming a specific place beyond what's listed could overclaim. But a SMALL
      // recorded field (fewer than 8) is very likely the complete field - small domestic/club meets
      // normally report everyone who competed, not a curated top list - so a "would have finished
      // last" estimate is trustworthy there, and worth showing if it would still score points for
      // this category (several categories' Placing Score tables pay down past 8th place).
      if (place == null && data.allMarks.length < 8) {
        const estimatedPlace = data.allMarks.length + 1;
        const estimatedScore = scoring.placingScore(event, category, estimatedPlace);
        if (estimatedScore != null && estimatedScore > 0) {
          place = estimatedPlace;
          lastPlaceEstimate = true;
        }
      }
      if (place == null) return null;
      const placingScore = scoring.placingScore(event, category, place);
      if (placingScore == null) return null;
      return {
        meet: m, place, category, lastPlaceEstimate,
        resultScore, placingScore,
        performanceScore: resultScore + placingScore,
        year: data.year || null,
        source: data.source || null,
        winnerMark: data.winnerMark ?? null,
        top3: Array.isArray(data.top3) ? data.top3 : null,
        top8: Array.isArray(data.top8) ? data.top8 : null,
      };
    }));
    scored = scored.concat(results.filter(Boolean)).sort((a, b) => b.performanceScore - a.performanceScore);
    if (scored.length >= 3) break;
  }

  return { pb, resultScore, currentRankingScore, probed: checked, top: scored.slice(0, 3) };
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
function avg(a){ return a.reduce((s, v) => s + v, 0) / a.length; }

// Same "2024: vinner 13.16 · topp 3 snitt 13.21 · topp 8 snitt 13.29" summary meet-history.js's
// own "Historisk nivå" card shows, so the actual level behind the estimated placing is visible
// here too instead of only the derived numbers (Performance Score etc.) - live feedback wanted the
// real marks shown, not just what they translate to.
function historicalLevelLine(x){
  const fmt = window.RankingstevnerMeetHistory?.formatMark;
  if (typeof fmt !== 'function' || !Number.isFinite(x.winnerMark)) return '';
  const event = eventCode();
  const segments = [`vinner ${fmt(x.winnerMark, event)}`];
  if (x.top3?.length > 1) segments.push(`topp ${x.top3.length} snitt ${fmt(avg(x.top3), event)}`);
  if (x.top8?.length > (x.top3?.length || 0)) segments.push(`topp ${x.top8.length} snitt ${fmt(avg(x.top8), event)}`);
  const yearBit = x.year ? `${x.year}: ` : '';
  return `<small class="muted" style="display:block;margin-top:2px">${yearBit}${segments.join(' · ')}</small>`;
}

// Estimated new WORLD RANKING POSITION for each recommended meet (the same live World Athletics
// world-rankings lookup the "Ny prestasjon" calculator's own "Ny ranking" field uses), fired off in
// the background after the cards already have their Performance Score/improvement text - this is a
// slow, best-effort external lookup (a binary search over WA's own public ranking pages), so it must
// never hold up the cards themselves. Silently leaves the placeholder empty on failure/timeout
// (never a fabricated position), same policy as the improvement figure above.
function loadRankPositions(items){
  const waId = (document.getElementById('waProfileId')?.value || '').trim().match(/(\d{7,9})/)?.[1];
  if (!waId) return;
  const event = eventCode();
  const sex = athleteSex();
  for (const x of items) {
    if (!Number.isFinite(x.rankProjected) || !x.meet?.id) continue;
    const meetId = x.meet.id;
    (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(`/api/wa-official-ranking?id=${encodeURIComponent(waId)}&event=${encodeURIComponent(event)}&sex=${encodeURIComponent(sex)}&newScore=${encodeURIComponent(x.rankProjected)}&v=1`, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        const ok = Number.isFinite(data?.estimatedNewRank) && data.estimatedNewRank > 0;
        if (!ok) return;
        const el = document.getElementById(`rrRank-${meetId}`);
        if (el) el.textContent = `Ny ranking: #${data.estimatedNewRank}`;
      } catch (_) {
        // timeout/network failure - leave the placeholder empty rather than guess
      } finally {
        clearTimeout(timeoutId);
      }
    })();
  }
}
function itemHtml(x, ownMarkText){
  const improvement = Number.isFinite(x.improvement) ? x.improvement : null;
  const improvementLine = improvement != null
    ? (improvement > 0
        ? `<small style="display:block;color:#45d483;font-weight:700">+${improvement} poeng mot din nåværende Ranking Score.</small>`
        : `<small style="display:block;color:#aebed0">${improvement} poeng mot din nåværende Ranking Score - fortsatt en sterk Performance Score, men ikke en forbedring akkurat nå.</small>`)
    // No established Ranking Score to compare against yet (too few tellende resultater i perioden) -
    // silently showing nothing here read as a missing/broken feature rather than what it actually is:
    // this result would BE the (start of the) ranking grunnlag, not an improvement on one that doesn't
    // exist yet. Distinct from x.hasCurrentScore being true but the delta calc itself not having
    // resolved yet - that case shows NOTHING here rather than either message, since neither "no score
    // yet" nor a fabricated number would be true - the box's own rankingbasisupdated listener re-runs
    // this once the real numbers are ready.
    : (x.hasCurrentScore ? '' : `<small style="display:block;color:#45d483;font-weight:700">Du har ingen etablert Ranking Score i denne øvelsen ennå - dette resultatet vil telle med i grunnlaget.</small>`);
  const yearBit = x.year ? ` (${x.year})` : '';
  const sourceLink = x.source ? ` · <a href="${esc(x.source)}" target="_blank" rel="noopener">Historisk nivå${yearBit}</a>` : '';
  // Clicking the card jumps down to the same meet's own full card (contact info, program,
  // "Historisk nivå" details) further down the page instead of duplicating all of that here.
  return `<div data-jump-to-meet="${esc(x.meet.id)}" style="padding:14px 16px;border:1px solid #21405f;border-radius:12px;background:#0b1d33;cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div><strong>${esc(x.meet.name || 'Stevne')}</strong><div class="muted" style="font-size:12px;margin-top:2px">${esc(locationText(x.meet) || 'Sted ikke publisert')} · ${fmtDate(x.meet.start)}</div>${historicalLevelLine(x)}</div>
      <span class="cat" title="${esc(CATEGORY_DESCRIPTIONS[x.category]||'')}">${esc(x.category)}</span>
    </div>
    <small style="display:block;margin-top:8px">Forventet ${ordinal(x.place)} plass med din beste tellende prestasjon (<strong>${esc(ownMarkText)}</strong>) → <strong>Performance Score ${x.performanceScore}</strong> (Result Score ${x.resultScore} + Placing Score ${x.placingScore})${sourceLink}</small>
    ${x.lastPlaceEstimate ? `<small class="muted" style="display:block;margin-top:2px">Anslag: din prestasjon var svakere enn alle ${x.place - 1} kjente resultatene, men feltet var lite nok til at sisteplass trolig fortsatt gir rankingpoeng.</small>` : ''}
    ${improvementLine}
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px">
      <small class="muted">Trykk for å se hele stevnekortet ↓</small>
      ${Number.isFinite(x.rankProjected) ? `<small id="rrRank-${esc(x.meet.id)}" style="color:#45d483;font-weight:700;white-space:nowrap"></small>` : ''}
    </div>
  </div>`;
}

function renderHtml(result){
  const heading = `<span class="eyebrow">ANBEFALTE STEVNER</span><h4 style="margin:6px 0 0;font-size:20px;color:#fff">${esc(eventLabel())}</h4>`;
  if (!result || result.reason === 'not-ready' || result.reason === 'no-event') return '';
  if (result.reason === 'no-own-mark') {
    const months = rankingPeriodMonths(eventCode());
    return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #21405f;border-radius:14px;background:#102a47;box-sizing:border-box">${heading}<p class="muted" style="margin:8px 0 0">Utøver mangler resultater for øvelsen i perioden (siste ${months} måneder) - ingen stevneanbefalinger å vise.</p></div>`;
  }
  if (result.reason === 'no-result-score') {
    return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #21405f;border-radius:14px;background:#102a47;box-sizing:border-box">${heading}<p class="muted" style="margin:8px 0 0">Fant ikke Result Score for din beste prestasjon i valgt øvelse ennå.</p></div>`;
  }
  const currentLine = Number.isFinite(result.currentRankingScore) ? ` Din nåværende Ranking Score: <strong>${result.currentRankingScore}</strong>.` : '';
  if (!result.top || !result.top.length) {
    return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #21405f;border-radius:14px;background:#102a47;box-sizing:border-box">${heading}<p class="muted" style="margin:8px 0 0">Fant ingen stevner med nok verifisert historisk nivå ennå til å gi konkrete anbefalinger (så langt sjekket ${result.probed} stevner).${currentLine}</p></div>`;
  }
  const ownMarkText = formatOwnMark(result);
  // The 3 candidates are CHOSEN by highest Performance Score (computeRecommendations' own sort) -
  // that selection logic is unchanged. Only the DISPLAY order is different: nearest meet first, so
  // the list reads like a practical shortlist of what's coming up rather than a ranked-by-score table.
  const scoring = window.RankingstevnerScoring;
  const items = result.top
    .slice()
    .sort((a, b) => new Date(a.meet.start) - new Date(b.meet.start))
    .map(x => {
      // A Ranking Score is the AVERAGE of the athlete's best counted Performance Scores, not any
      // single meet's Performance Score on its own - diffing performanceScore straight against
      // currentRankingScore overstates the improvement whenever a strong result already counts
      // toward that average. projectedRankingScore() returns BOTH current and projected from the
      // exact same selection (mirroring the "Ny prestasjon" calculator's own Main-Event-aware
      // search), so the two numbers can only agree with each other, never independently disagree.
      //
      // Deliberately no numeric fallback when it returns null (e.g. the local reconstruction
      // hasn't finished loading all counted results yet, or genuinely can't satisfy the Main Event
      // requirement from what's loaded so far) - confirmed live that showing performanceScore minus
      // currentRankingScore "just to show something" produced a WRONG number that didn't match the
      // calculator (+24 shown here vs its +10 for the identical hypothetical result). An honest
      // "not shown yet" is strictly better than a plausible-looking wrong one - and since this box
      // already re-runs on rankingbasisupdated (fired whenever the local basis genuinely changes),
      // a transient "still loading" case corrects itself on its own the moment real data lands,
      // without ever having shown a fabricated number in the meantime.
      const delta = scoring?.projectedRankingScore?.(eventCode(), x.performanceScore);
      const improvement = Number.isFinite(delta?.current) && Number.isFinite(delta?.projected)
        ? delta.projected - delta.current
        : null;
      return { ...x, improvement, hasCurrentScore: Number.isFinite(result.currentRankingScore), rankProjected: Number.isFinite(delta?.projected) ? delta.projected : null };
    });
  loadRankPositions(items);
  return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #21405f;border-radius:14px;background:#102a47;box-sizing:border-box">
    ${heading}
    <p class="muted" style="margin:8px 0 12px">Stevner der høy stevnekategori og et historisk sett svakt felt gir best mulighet til å forbedre rankingen din, basert på din beste tellende prestasjon (${ownMarkText}).${currentLine}</p>
    <div style="display:grid;gap:10px">${items.map(x => itemHtml(x, ownMarkText)).join('')}</div>
  </div>`;
}

// Uses meet-history.js's own formatting (already loaded, same event code conventions) so a time
// looks like "10.72"/"1:45.20" rather than a raw seconds float.
function formatOwnMark(result){
  const fmt = window.RankingstevnerMeetHistory?.formatMark;
  if (typeof fmt === 'function') return fmt(result.pb, eventCode());
  return String(result.pb);
}

// Blinking (not just static "loading") text specifically for the progress state, per explicit
// request - a full search across many meets can take a while, and a static message reads as stuck
// the same way the earlier permanently-blank bug did; a visibly animated one makes it obvious this
// is still actively working.
function ensureBlinkStyle(){
  if (document.getElementById('rankingRecommendationsBlinkStyle')) return;
  const style = document.createElement('style');
  style.id = 'rankingRecommendationsBlinkStyle';
  style.textContent = '.rr-blink{animation:rrBlinkPulse 1.2s ease-in-out infinite}@keyframes rrBlinkPulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes rrSpin{to{transform:rotate(360deg)}}.rr-spinner{display:inline-block;width:14px;height:14px;margin-right:7px;border:2px solid #21405f;border-top-color:#ff8a19;border-radius:50%;vertical-align:-2px;animation:rrSpin .75s linear infinite}';
  document.head.appendChild(style);
}
// Rough, self-calibrating estimate rather than a hardcoded guess - extrapolates from how long the
// batches checked so far actually took. Deliberately rounded to a coarse bucket (5s below 30s, 10s
// above) so it reads as an approximation and doesn't visibly jitter on every batch tick. The search
// can (and often does) stop early once 3 good candidates are found - candidates.length is only the
// worst case - so this can overshoot; that just means the box finishes sooner than shown, which is
// the safe direction to be wrong in.
function estimateSecondsRemaining(startedAt, checked, total){
  if (!checked || !total || total <= checked) return null;
  const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
  if (elapsedMs <= 0) return null;
  const msPerItem = elapsedMs / checked;
  const etaSeconds = Math.round((msPerItem * (total - checked)) / 1000);
  if (etaSeconds < 3) return null; // about to finish - not worth showing
  const bucket = etaSeconds < 30 ? 5 : 10;
  return Math.round(etaSeconds / bucket) * bucket;
}
function formatEta(seconds){
  if (!seconds) return '';
  const text = seconds < 60 ? `${seconds} sek` : `${Math.round(seconds / 60)} min`;
  return `, ca. ${text} igjen`;
}
function loadingBoxHtml(text, blink){
  ensureBlinkStyle();
  return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #21405f;border-radius:14px;background:#102a47;box-sizing:border-box"><span class="eyebrow">ANBEFALTE STEVNER</span><h4 style="margin:6px 0 0;font-size:20px;color:#fff">${esc(eventLabel())}</h4><p class="muted${blink ? ' rr-blink' : ''}" style="margin:8px 0 0"><span class="rr-spinner" aria-hidden="true"></span>${esc(text)}</p></div>`;
}

let runId = 0;
let computing = false;
const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
// Elapsed-time tracking lives at module level, keyed by event+sex, deliberately OUTSIDE recompute()
// itself - live evidence showed a per-call heartbeat (a setInterval started fresh inside each
// recompute() invocation) never actually got a chance to fire: meet-finder-v1.js's render() can
// restart the whole search (via 'meetlistrendered' -> scheduleRecompute) more often than every 10
// seconds - a MutationObserver on the athlete-profile status element alone can fire several times
// while a profile is still loading - so every individual attempt died in its own `finally` well
// before its own local timer ever reached 10s, no matter how long the user had actually been
// waiting in total. Tracking "when did THIS logical search start" and "when did the box last show
// something new" here instead survives any number of such restarts for the same event+sex.
let searchKey = null;
let searchStartedAt = null;
let lastBoxUpdateAt = null;
function box(){ return document.getElementById('rankingRecommendations'); }
function noteBoxUpdate(){ lastBoxUpdateAt = now(); }
// meet-finder-v1.js's render() doesn't just clear the box's content, it replaces the whole element
// with a brand new, always-empty one - so "only fill an empty box" alone still fell back to the
// bare, context-free default text on every single restart, even 30+ seconds into the same logical
// search: the fresh node has no way to know that on its own. Consulting searchStartedAt (which does
// survive the node being swapped out) whenever ANYTHING fills an empty box closes that gap - a
// restart deep into an already-slow search shows the elapsed time immediately, instead of only
// after the next heartbeat tick finds this new node 10s later.
function initialLoadingHtml(){
  const elapsed = searchStartedAt ? now() - searchStartedAt : 0;
  if (elapsed >= 10000) {
    return loadingBoxHtml(`Beregner anbefalinger … (${Math.round(elapsed / 1000)} sek, dette tar litt tid) …`, true);
  }
  return loadingBoxHtml('Beregner anbefalinger …', false);
}
// Runs for the page's whole lifetime (never cleared) rather than per search attempt. Only acts
// while the box is both present and still genuinely in a loading state - renderHtml()'s finished
// output (a real result OR a dead-end explanatory message) never contains the spinner markup
// loadingBoxHtml() always includes, so that's a reliable "still working" signal that also correctly
// stops this once a search actually finishes, instead of stacking elapsed-time text on top of a
// completed message forever.
setInterval(() => {
  if (!searchStartedAt || lastBoxUpdateAt == null) return;
  const b = box();
  if (!b || !b.querySelector('.rr-spinner')) return;
  if (now() - lastBoxUpdateAt < 10000) return;
  const elapsed = Math.round((now() - searchStartedAt) / 1000);
  b.innerHTML = loadingBoxHtml(`Beregner anbefalinger … (${elapsed} sek, dette tar litt tid) …`, true);
  noteBoxUpdate();
}, 2000);
// Always re-fetches the live element instead of reusing one grabbed at the start of recompute() -
// meet-finder-v1.js's render() replaces #kvalifiseringBoxes' entire innerHTML (a fresh, empty
// #rankingRecommendations div included) on every filter/event/sex change AND on unrelated triggers
// (see above). If that happens while a computeRecommendations() run is mid-flight, a box reference
// captured once at the top of recompute() silently becomes a DETACHED node - every later write via
// that stale reference (progress updates, the final result) still "succeeds" as far as the code is
// concerned, but is invisible, since the visible tree now has a *different* element with the same
// id. Confirmed live: this is why the box could sit on the initial static text indefinitely no
// matter how long a search actually took - every write was landing on a node nobody could see.
// Re-querying by id right before each write always targets whatever is currently on screen.
async function recompute(){
  if (!box()) return;
  const key = `${eventCode()}|${athleteSex()}`;
  if (key !== searchKey) { searchKey = key; searchStartedAt = now(); }
  // Shown immediately whenever the box is currently empty, so it's never an invisible blank space
  // while a computation runs - live evidence showed users reading "nothing there" as broken rather
  // than loading. This used to be gated behind an "only the very first time ever" flag, which broke
  // on an event/sex change: meet-finder-v1.js rebuilds the ENTIRE meet list (a fresh, empty
  // #rankingRecommendations div included) on every such change, so "first time ever" had already
  // happened once for a previous event and the flag suppressed the loading text for every event
  // switch after that - leaving a genuinely empty box with nothing shown while it recomputed.
  // Checking the box's own current content instead of a one-shot flag fixes that for every event
  // change, not just the very first render.
  if (!box().innerHTML) {
    box().innerHTML = initialLoadingHtml();
    noteBoxUpdate();
  }
  const myRun = ++runId;
  if (computing) return; // a newer trigger will run right after this one finishes anyway
  computing = true;
  const startedAt = now();
  function writeProgress(checked, total){
    noteBoxUpdate();
    const eta = formatEta(estimateSecondsRemaining(startedAt, checked, total));
    const b = box(); if (b) b.innerHTML = loadingBoxHtml(`Jobber med å ta frem anbefalte rankingstevner basert på din ranking (sjekket ${checked} av ${total} stevner${eta}) …`, true);
  }
  try {
    const result = await computeRecommendations((checked, total) => {
      if (myRun !== runId) return; // superseded - don't fight the newer run's own rendering
      writeProgress(checked, total);
    });
    if (myRun !== runId) return; // event/sex changed again while this was in flight
    if (result?.reason === 'not-ready') {
      scheduleRecompute(1000);
      return; // leave the loading state (or whatever was already showing) rather than blanking it - the module-level heartbeat above covers a long wait here too
    }
    const b = box(); if (b) b.innerHTML = renderHtml(result);
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
  card.style.outline = '3px solid #ff8a19';
  card.style.outlineOffset = '2px';
  setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 1800);
  showBackButton();
}
document.addEventListener('click', e => {
  const item = e.target.closest('[data-jump-to-meet]');
  if (!item || e.target.closest('a')) return; // let the "Historisk nivå" link open normally
  jumpToMeet(item.dataset.jumpToMeet);
});

// Floating "back to recommendations" button - jumping to a meet card can land far down the page
// (especially on mobile, where every card takes up much more vertical space), and scrolling all the
// way back up by hand was the explicit complaint this fixes. Created once and shown/hidden rather
// than recreated per jump; auto-hides via IntersectionObserver once the recommendations panel is
// back in view, so it doesn't linger as dead chrome after the user has already scrolled back.
let backButtonObserver = null;
function ensureBackButton(){
  let btn = document.getElementById('rrBackToRecommendations');
  if (btn) return btn;
  btn = document.createElement('button');
  btn.id = 'rrBackToRecommendations';
  btn.type = 'button';
  btn.textContent = '↑ Tilbake til Anbefalte stevner';
  btn.style.cssText = 'display:none;position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:50;border:1px solid #ff8a19;border-radius:999px;padding:11px 18px;font-weight:800;font-size:13px;background:#102a47;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.45);cursor:pointer';
  btn.addEventListener('click', () => {
    const target = document.getElementById('kvalifiseringPanel') || document.getElementById('rankingRecommendations');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.style.display = 'none';
  });
  document.body.appendChild(btn);
  return btn;
}
function showBackButton(){
  const btn = ensureBackButton();
  btn.style.display = 'block';
  const target = document.getElementById('kvalifiseringPanel') || document.getElementById('rankingRecommendations');
  if (!target || !('IntersectionObserver' in window)) return;
  backButtonObserver?.disconnect();
  backButtonObserver = new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting) {
      btn.style.display = 'none';
      backButtonObserver.disconnect();
    }
  }, { threshold: 0.3 });
  backButtonObserver.observe(target);
}

// Puts the loading text up immediately, synchronously - separate from the actual (debounced,
// potentially slow) recompute. Live feedback: it's fine for the recommendations themselves to take
// a while to fill in, but the box going blank and only showing "Beregner..." after the debounce
// delay (500-700ms) read as broken in that gap. Wired into every trigger below, not just the
// event/sex change listeners: meet-finder-v1.js rebuilds #rankingRecommendations as a fresh empty
// div on its OWN render cycle (itself triggered by the same event/sex change, independently of this
// file), and that rebuild reliably lands between this file's own listener firing and its debounced
// recompute actually running - so meetlistrendered needs this too, not only the raw DOM event.
function showWorkingNow(){
  const b = box();
  // Only fills in a genuinely EMPTY box (a fresh node meet-finder-v1.js's render() just created),
  // never overwrites one that already has ANY content - this used to unconditionally reset back to
  // the bare "Beregner anbefalinger …" on every single meetlistrendered event (an athlete-profile
  // status change can fire that repeatedly, faster than every 10s, while a profile is still
  // loading), which wiped out the module-level heartbeat's own elapsed-time updates again and again
  // before a user ever got the chance to actually see one - the timestamps kept advancing correctly
  // underneath, but the DISPLAYED text kept getting stomped back to the plain default.
  if (b && !b.innerHTML) { b.innerHTML = initialLoadingHtml(); noteBoxUpdate(); }
}

document.addEventListener('DOMContentLoaded', () => {
  scheduleRecompute(300);
  // Delayed a bit more than before (50ms -> 500ms) so the visible cards' own history fetches
  // (meet-history-ui.js's apply(), triggered by this same event) get a head start claiming the
  // shared queue/cache first - since this box's own probe pool normally overlaps heavily with the
  // visible cards, letting cards go first means more of this box's own lookups arrive as instant
  // cache hits instead of adding a second, competing burst of fresh queue entries on top.
  window.addEventListener('meetlistrendered', () => { showWorkingNow(); scheduleRecompute(500); });
  // The athlete's own PB, current Ranking Score, and the scoring tables all become available via
  // this same event (ranking-basis.js) - a second trigger for cases where the box's first attempt
  // ran before any of that was ready and no event/sex change happens afterward to prompt a retry.
  window.addEventListener('rankingbasisupdated', () => scheduleRecompute(300));
  document.getElementById('event')?.addEventListener('change', () => { showWorkingNow(); scheduleRecompute(600); });
  document.getElementById('sex')?.addEventListener('change', () => { showWorkingNow(); scheduleRecompute(700); });
  // Confirmed live: this box's own improvement/rank figures can go stale relative to whatever the
  // "Ny prestasjon" calculator shows a moment later, if the athlete's local ranking grunnlag
  // (allResults) changed anywhere in the time since this box last computed - projectedRankingScore()
  // itself always reads that data fresh when called, but nothing forced this box to CALL it again
  // just because the user is actively comparing the two right now. Clicking "Beregn rankingeffekt"
  // is exactly the moment a live, side-by-side comparison happens, so re-running this box's own
  // search right then keeps the two as close to the same instant of truth as this architecture allows.
  document.getElementById('calculate')?.addEventListener('click', () => scheduleRecompute(400));
});
})();
