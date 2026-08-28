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

// WA's own world ranking for men's combined events pools outdoor Decathlon (10 events) and
// indoor Heptathlon (7 events) marks together into one ranking basis (women: outdoor
// Heptathlon + indoor Pentathlon) - this app's "Tellende rankinggrunnlag" mirrors that on
// purpose. But an outdoor 10-event total and an indoor 7-event total aren't on the same raw
// points scale (more events structurally means more points), so comparing "what place would my
// best mark get" against one specific meet's field needs the mark from the SAME real-world
// discipline as that meet - otherwise an outdoor decathlon PB looks artificially unbeatable
// against every indoor meet.
//
// Confirmed wrong on the first live test: this data (window.__rankingstevnerOfficialRanking.basis)
// comes from WA's official ranking calculation API (wa-official-ranking.js), not the same raw
// results feed ranking-basis.js reads its own discipline names from - reusing that file's
// "short track"/"sh" suffix check here rejected a genuine indoor Heptathlon result because this
// API just reports it as plain "Heptathlon", no suffix. Men only ever have two possible
// real-world combined-event names (Decathlon=outdoor, Heptathlon=indoor - never both for the
// same season), so plain name matching is enough and unambiguous; no suffix needed.
function normDiscipline(s){ return String(s||'').toLowerCase().replace(/metres?|meters?/g,'m').replace(/[^a-z0-9]+/g,''); }
function matchesEventVariant(discipline, code, indoor){
  const n = normDiscipline(discipline);
  if (code === 'Decathlon') return indoor ? n.startsWith('heptathlon') : n.startsWith('decathlon');
  if (code === 'Heptathlon') return indoor ? n.startsWith('pentathlon') : n.startsWith('heptathlon');
  return false;
}
// The best mark among the athlete's own currently-counting WA results for the specific
// indoor/outdoor discipline this meet actually is (the same table shown under "Tellende
// rankinggrunnlag") - not literally an all-time PB, but the closest thing already available
// without a separate fetch.
//
// Also returns a diagnostics object alongside the mark: a live test showed no placement line at
// all for an athlete who does have a genuine counting result in the right discipline, and rather
// than guess a third time at what field/shape is actually wrong without being able to inspect it
// myself, surfacing the raw basis contents lets the next live check show the real cause directly.
function bestOwnMark(indoor){
  const event = eventCode();
  const official = window.__rankingstevnerOfficialRanking;
  const basis = official?.basis;
  const diag = { indoor, event, hasOfficialRanking: !!official, basisIsArray: Array.isArray(basis), basisLength: Array.isArray(basis) ? basis.length : null };
  if (!Array.isArray(basis) || !basis.length) return { mark: null, diag };
  diag.basisEntries = basis.map(b => ({ discipline: b.discipline, result: b.result, matched: matchesEventVariant(b.discipline, event, indoor) }));
  const relevant = basis.filter(b => matchesEventVariant(b.discipline, event, indoor));
  const marks = relevant.map(b => Number(b.result)).filter(Number.isFinite);
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
