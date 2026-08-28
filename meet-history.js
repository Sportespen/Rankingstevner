// Historisk nivå for hvert stevne - finner forrige utgave av stevnet i World Athletics'
// kalender og henter dens faktiske sluttresultater i mangekamp-øvelsen, i stedet for en
// håndskrevet liste over noen få stevner.
(() => {
'use strict';
const cache = new Map();

function eventCode(){ return document.getElementById('event')?.value || ''; }
function avg(a){ return Math.round(a.reduce((s,x)=>s+x,0)/a.length); }

function fetchHistory(name, date){
  const event = eventCode();
  if (event !== 'Decathlon' && event !== 'Heptathlon') return Promise.resolve(null);
  const key = `${name}|${date||''}|${event}`;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    try {
      const res = await fetch(`/api/meet-history?name=${encodeURIComponent(name)}&event=${encodeURIComponent(event)}&date=${encodeURIComponent(date||'')}&v=1`, { cache: 'no-store' });
      const data = await res.json();
      return data?.ok ? data : { found: false, diagnostics: [{ source: 'fetch', status: res.status, body: data }] };
    } catch (e) { return { found: false, diagnostics: [{ source: 'fetch', error: String(e?.message || e) }] }; }
  })();
  cache.set(key, p);
  return p;
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
// window.__rankingstevnerCombinedResults.rows (exposed by ranking-basis.js) bypasses that
// entirely: only legal + date-valid + discipline classified, no ranking-score reconstruction.
function bestOwnMark(indoor){
  const event = eventCode();
  const combined = window.__rankingstevnerCombinedResults;
  const rows = combined?.event === event ? combined.rows : null;
  const diag = { indoor, event, hasCombinedResults: !!combined, combinedEvent: combined?.event || null, rowsIsArray: Array.isArray(rows), rowCount: Array.isArray(rows) ? rows.length : null };
  if (!Array.isArray(rows) || !rows.length) return { mark: null, diag };
  // For code='Decathlon' (men): 'main'=outdoor Decathlon, 'similar'=indoor Heptathlon.
  // For code='Heptathlon' (women): 'main'=outdoor Heptathlon, 'similar'=indoor Pentathlon.
  const wantType = indoor ? 'similar' : 'main';
  diag.rowEntries = rows.map(r => ({ discipline: r.discipline, mark: r.mark, type: r.type, matched: r.type === wantType }));
  const relevant = rows.filter(r => r.type === wantType);
  const marks = relevant.map(r => Number(r.mark)).filter(Number.isFinite);
  return { mark: marks.length ? Math.max(...marks) : null, diag };
}
function placementFor(allMarks, mark){
  if (!Array.isArray(allMarks) || !allMarks.length || !Number.isFinite(mark)) return null;
  return allMarks.filter(m => m > mark).length + 1;
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
  const { mark: pb, diag: pbDiag } = bestOwnMark(indoor);
  const place = pb != null ? placementFor(data.allMarks, pb) : null;
  const placeLine = place != null
    ? `<small style="display:block;color:#087f5b;font-weight:700">Din beste tellende prestasjon (${pb} p) ville gitt ${ordinal(place)} plass i dette stevnet.</small>`
    : '';
  // Not every meet has a confirmed top 8 (or even top 3) - some sources only reported a
  // winner. Labelling the stat with however many marks actually went into it (instead of a
  // fixed "topp 3"/"topp 8") avoids implying more depth than what's actually verified.
  const segments = [`vinner ${data.winnerMark} p`];
  if (data.top3?.length > 1) segments.push(`topp ${data.top3.length} snitt ${avg(data.top3)} p`);
  if (data.top8?.length > (data.top3?.length || 0)) segments.push(`topp ${data.top8.length} snitt ${avg(data.top8)} p`);
  return `<strong>${data.year}: ${segments.join(' · ')}</strong><small>Vinner: ${data.winner || 'ukjent'}. <a href="${data.source}" target="_blank" rel="noopener">Se offisielle WA-resultater</a></small>${placeLine}${diagnosticsHtml({ diagnostics: [{ source: 'own-mark', ...pbDiag }] })}`;
}

window.RankingstevnerMeetHistory = {
  loadingHtml: '<strong>Søker i World Athletics-kalenderen …</strong><small>Henter forrige utgave av stevnet.</small>',
  async htmlAsync(name, date, indoor){
    const data = await fetchHistory(name, date);
    return renderHtml(data, indoor);
  }
};
})();
