// Historisk nivå for hvert stevne - finner forrige utgave av stevnet i World Athletics'
// kalender og henter dens faktiske sluttresultater i den valgte øvelsen, i stedet for en
// håndskrevet liste over noen få stevner. Fungerer likt for mangekamp og enkeltøvelser -
// samme funksjoner, forskjellig fremstilling (poeng vs. tid/lengde, stigende vs. synkende
// rekkefølge) styrt av hva API-et rapporterer tilbake (`ascending`) og øvelseskoden selv.
(() => {
'use strict';
const cache = new Map();

const TRACK_EVENTS = new Set(['100m', '200m', '400m', '800m', '1500m', '5000m', '10000m', '100mH', '110mH', '400mH', '3000mSC']);

function eventCode(){ return document.getElementById('event')?.value || ''; }
function athleteSex(){ return document.getElementById('sex')?.value === 'W' ? 'W' : 'M'; }
function isCombinedCode(event){ return event === 'Decathlon' || event === 'Heptathlon'; }
function avg(a){ return a.reduce((s,x)=>s+x,0)/a.length; }

function fetchHistory(name, date){
  const event = eventCode();
  if (!event) return Promise.resolve(null);
  const sex = athleteSex();
  const key = `${name}|${date||''}|${event}|${sex}`;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    try {
      const res = await fetch(`/api/meet-history?name=${encodeURIComponent(name)}&event=${encodeURIComponent(event)}&date=${encodeURIComponent(date||'')}&sex=${encodeURIComponent(sex)}&v=2`, { cache: 'no-store' });
      const data = await res.json();
      return data?.ok ? data : { found: false, diagnostics: [{ source: 'fetch', status: res.status, body: data }] };
    } catch (e) { return { found: false, diagnostics: [{ source: 'fetch', error: String(e?.message || e) }] }; }
  })();
  cache.set(key, p);
  return p;
}

// Time marks come back from the backend as plain seconds (see functions/api/meet-history.js'
// parseIndividualMark) - not the "10.32"/"1:45.20" shape a user actually reads times in.
// Converts back to that shape for display. Field-event marks (metres) need no conversion.
function formatTime(totalSeconds){
  if (!Number.isFinite(totalSeconds)) return '';
  const wholeSeconds = Math.floor(totalSeconds);
  const hundredths = Math.round((totalSeconds - wholeSeconds) * 100);
  const h = Math.floor(wholeSeconds / 3600);
  const m = Math.floor((wholeSeconds % 3600) / 60);
  const s = wholeSeconds % 60;
  const frac = String(hundredths).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${frac}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${frac}`;
  return `${s}.${frac}`;
}
function formatMark(mark, event){
  if (!Number.isFinite(mark)) return '';
  if (isCombinedCode(event)) return `${mark} p`;
  if (TRACK_EVENTS.has(event)) return formatTime(mark);
  return `${mark} m`;
}

// An outdoor 10-event total and an indoor 7-event total aren't on the same raw points scale
// (more events structurally means more points), so comparing "what place would my best mark
// get" against one specific meet's field needs the mark from the SAME real-world discipline as
// that meet - otherwise an outdoor decathlon PB looks artificially unbeatable against every
// indoor meet.
//
// Two earlier attempts at this got the data source wrong. First,
// window.__rankingstevnerOfficialRanking.basis only holds the top `needed` (2) results actually
// selected for the athlete's combined ranking SCORE. Then window.__rankingstevnerReconstructedBasis
// .candidates looked like the fix, but a second live diagnostics dump showed it was ALSO missing
// a real, legal indoor Heptathlon Short Track result (5788pts, confirmed via the athlete's own WA
// seasons-best page) - because that list is built by candidate(), which additionally requires
// resolving a WA Result Score + a placingTables[category][place-1] lookup to succeed. That
// machinery is for reconstructing a ranking SCORE and has nothing to do with "what did they
// score in this discipline" - a result missing/failing either lookup got silently dropped
// regardless of being a perfectly valid mark.
// window.__rankingstevnerOwnResults.rows (exposed by ranking-basis.js) bypasses that entirely:
// only legal + date-valid + discipline classified, no ranking-score reconstruction. It works the
// same way for individual events (a single 'main' type, no indoor/outdoor split) as for combined
// events ('main'/'similar' for the outdoor/indoor sub-discipline).
function bestOwnMark(indoor, ascending){
  const event = eventCode();
  const own = window.__rankingstevnerOwnResults;
  const rows = own?.event === event ? own.rows : null;
  const diag = { indoor, event, ascending, hasOwnResults: !!own, resultsEvent: own?.event || null, rowsIsArray: Array.isArray(rows), rowCount: Array.isArray(rows) ? rows.length : null };
  if (!Array.isArray(rows) || !rows.length) return { mark: null, diag };
  const wantType = isCombinedCode(event) ? (indoor ? 'similar' : 'main') : 'main';
  diag.rowEntries = rows.map(r => ({ discipline: r.discipline, mark: r.mark, type: r.type, matched: r.type === wantType }));
  const relevant = rows.filter(r => r.type === wantType);
  const marks = relevant.map(r => Number(r.mark)).filter(Number.isFinite);
  if (!marks.length) return { mark: null, diag };
  return { mark: ascending ? Math.min(...marks) : Math.max(...marks), diag };
}
// allMarks is only ever the marks a source actually reported - sometimes the full field, often
// just the winner, or a top3/top8. Reported live: two meets whose VERIFIED entry only records
// the winner's mark (Tallinn: [6045], European Indoor Champs: [6558]) both claimed "2. plass"
// for an athlete scoring well below the winner - the arithmetic (count marks above yours, +1)
// mechanically produces "2nd" against a 1-mark list regardless of how big the real field was.
// The count is only trustworthy once the athlete's own mark reaches down to the weakest mark we
// actually have data for - anyone below OUR list's bottom "necessarily" scored under it too, so
// nothing beyond that point is missing. Below our list's bottom, there could be any number of
// unlisted finishers between the athlete and the marks we know about, so no place can honestly
// be claimed. "Below"/"above" here means "worse"/"better" - for track events (ascending: lower
// wins) that's the opposite direction on the number line from points/distance events.
// For a "not comparable" match (e.g. meet ran 60m instead of the selected 100m), this looks up
// the athlete's OWN best mark for that exact substitute distance (from other indoor meets, via
// ranking-basis.js's now-exposed 'similar'-type rows) - so a real placement comparison can still
// be made using like-for-like data, instead of only ever showing the substitute results as an
// unattributed reference. altCode is this app's own event-code convention ('60m','60mH'), from
// the backend's `matchedEventCode`; discipline text is normalized the same lightweight way (WA's
// raw text varies: "60 Metres", "60m", etc.) rather than requiring an exact string match.
function normDiscipline(s){ return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/hurdles?/g,'h').replace(/[^a-z0-9]+/g,''); }
function bestOwnMarkForCode(altCode, ascending){
  const event = eventCode();
  const own = window.__rankingstevnerOwnResults;
  const rows = own?.event === event ? own.rows : null;
  const wantDisc = normDiscipline(altCode);
  const diag = { altCode, event, ascending, hasOwnResults: !!own, resultsEvent: own?.event || null, rowsIsArray: Array.isArray(rows), rowCount: Array.isArray(rows) ? rows.length : null };
  if (!Array.isArray(rows) || !rows.length) return { mark: null, diag };
  diag.rowEntries = rows.map(r => ({ discipline: r.discipline, mark: r.mark, type: r.type, normDiscipline: normDiscipline(r.discipline), matched: r.type === 'similar' && normDiscipline(r.discipline) === wantDisc }));
  const relevant = rows.filter(r => r.type === 'similar' && normDiscipline(r.discipline) === wantDisc);
  const marks = relevant.map(r => Number(r.mark)).filter(Number.isFinite);
  if (!marks.length) return { mark: null, diag };
  return { mark: ascending ? Math.min(...marks) : Math.max(...marks), diag };
}
function placementFor(allMarks, mark, ascending){
  if (!Array.isArray(allMarks) || !allMarks.length || !Number.isFinite(mark)) return null;
  if (ascending) {
    if (mark > Math.max(...allMarks)) return null;
    return allMarks.filter(m => m < mark).length + 1;
  }
  if (mark < Math.min(...allMarks)) return null;
  return allMarks.filter(m => m > mark).length + 1;
}
function worstKnownMark(allMarks, ascending){
  if (!Array.isArray(allMarks) || !allMarks.length) return null;
  return ascending ? Math.max(...allMarks) : Math.min(...allMarks);
}
function ordinal(n){ return `${n}.`; }

function esc(s){ return String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
// Temporary while this lookup is unverified against live WA data (network-blocked from the
// dev sandbox) - shows exactly why a match failed instead of just "not found", the same
// pattern already used for the official WA ranking lookup's "WA-diagnostikk" block.
function diagnosticsHtml(data){
  if (!data?.diagnostics) return '';
  const diag = esc(JSON.stringify(data.diagnostics, null, 2));
  return `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:#677585">Diagnostikk</summary><pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;background:#f7f9fb;padding:8px;border-radius:6px;margin-top:6px">${diag}</pre></details>`;
}

function renderHtml(data, indoor){
  if (!data || !data.found) {
    return `<strong>Historiske resultater er ikke verifisert ennå.</strong><small>Fant ikke forrige utgave av stevnet i World Athletics-kalenderen.</small>${diagnosticsHtml(data)}`;
  }
  const event = eventCode();
  const ascending = !!data.ascending;
  // Indoor meets substitute a genuinely shorter distance for some sprints/hurdles (e.g. 60m
  // instead of 100m - see meet-history.js on the backend for the confirmed list) - a mark over a
  // different distance isn't comparable to the athlete's own mark for this event, so no
  // placement claim is made against it. comparable is absent (not just true) for combined-event
  // responses and the hand-researched VERIFIED table, both always same-distance/discipline.
  const comparable = data.comparable !== false;
  let placeLine = '', pbDiag = null;
  if (comparable) {
    const own = bestOwnMark(indoor, ascending);
    pbDiag = own.diag;
    const pb = own.mark;
    const place = pb != null ? placementFor(data.allMarks, pb, ascending) : null;
    const worst = worstKnownMark(data.allMarks, ascending);
    const outsideKnownRange = pb != null && worst != null && (ascending ? pb > worst : pb < worst);
    placeLine = place != null
      ? `<small style="display:block;color:#087f5b;font-weight:700">Din beste tellende prestasjon (${formatMark(pb, event)}) ville gitt ${ordinal(place)} plass i dette stevnet.</small>`
      : outsideKnownRange
        ? `<small style="display:block;color:#677585">Din beste tellende prestasjon (${formatMark(pb, event)}) er svakere enn det svakeste resultatet vi har data på (${formatMark(worst, event)}) - nøyaktig plassering kan ikke fastslås med det datagrunnlaget som er verifisert for dette stevnet.</small>`
        : '';
  } else {
    const eventLabel = document.getElementById('event')?.selectedOptions?.[0]?.textContent || event;
    const altLabel = data.matchedEventCode || data.matchedEventName || 'en kortere distanse';
    // Try the athlete's own best mark for the SAME substitute distance the meet actually used
    // (e.g. their own 60m PB from other indoor meets) before falling back to showing the
    // substitute results as an unattributed reference - a like-for-like comparison is possible
    // whenever the athlete has run that distance themselves, even though it isn't their main
    // event's own distance.
    const altOwn = data.matchedEventCode ? bestOwnMarkForCode(data.matchedEventCode, ascending) : { mark: null, diag: null };
    pbDiag = altOwn.diag;
    const altPb = altOwn.mark;
    if (altPb != null) {
      const place = placementFor(data.allMarks, altPb, ascending);
      const worst = worstKnownMark(data.allMarks, ascending);
      const outsideKnownRange = worst != null && (ascending ? altPb > worst : altPb < worst);
      placeLine = place != null
        ? `<small style="display:block;color:#087f5b;font-weight:700">Din beste egen ${esc(altLabel)}-tid (${formatMark(altPb, event)}) ville gitt ${ordinal(place)} plass i dette stevnet.</small>`
        : outsideKnownRange
          ? `<small style="display:block;color:#677585">Din beste egen ${esc(altLabel)}-tid (${formatMark(altPb, event)}) er svakere enn det svakeste resultatet vi har data på (${formatMark(worst, event)}) - nøyaktig plassering kan ikke fastslås med det datagrunnlaget som er verifisert for dette stevnet.</small>`
          : `<small style="display:block;color:#677585">Stevnet var innendørs og kjørte ${esc(altLabel)} i stedet for ${esc(eventLabel)} - resultatene under viser stevnets nivå, men kan ikke sammenlignes direkte med din egen tid.</small>`;
    } else {
      placeLine = `<small style="display:block;color:#677585">Stevnet var innendørs og kjørte ${esc(altLabel)} i stedet for ${esc(eventLabel)} - du har ingen egne ${esc(altLabel)}-resultater registrert, så resultatene under viser kun stevnets nivå og kan ikke sammenlignes direkte med din egen tid.</small>`;
    }
  }
  // Not every meet has a confirmed top 8 (or even top 3) - some sources only reported a
  // winner. Labelling the stat with however many marks actually went into it (instead of a
  // fixed "topp 3"/"topp 8") avoids implying more depth than what's actually verified.
  const segments = [`vinner ${formatMark(data.winnerMark, event)}`];
  if (data.top3?.length > 1) segments.push(`topp ${data.top3.length} snitt ${formatMark(avg(data.top3), event)}`);
  if (data.top8?.length > (data.top3?.length || 0)) segments.push(`topp ${data.top8.length} snitt ${formatMark(avg(data.top8), event)}`);
  const diagEntry = pbDiag ? { source: comparable ? 'own-mark' : 'alt-own-mark', ...pbDiag } : { source: 'not-comparable', matchedEventName: data.matchedEventName || null };
  return `<strong>${data.year}: ${segments.join(' · ')}</strong><small>Vinner: ${data.winner || 'ukjent'}. <a href="${data.source}" target="_blank" rel="noopener">Se offisielle WA-resultater</a></small>${placeLine}${diagnosticsHtml({ diagnostics: [diagEntry] })}`;
}

window.RankingstevnerMeetHistory = {
  loadingHtml: '<strong>Søker i World Athletics-kalenderen …</strong><small>Henter forrige utgave av stevnet.</small>',
  async htmlAsync(name, date, indoor){
    const data = await fetchHistory(name, date);
    return renderHtml(data, indoor);
  }
};
})();
