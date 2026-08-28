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
      return data?.ok ? data : null;
    } catch (_) { return null; }
  })();
  cache.set(key, p);
  return p;
}

// The best mark among the athlete's own currently-counting WA results (the same table shown
// under "Tellende rankinggrunnlag") - not literally an all-time PB, but the closest thing
// already available without a separate fetch.
function bestOwnMark(){
  const basis = window.__rankingstevnerOfficialRanking?.basis;
  if (!Array.isArray(basis) || !basis.length) return null;
  const marks = basis.map(b => Number(b.result)).filter(Number.isFinite);
  return marks.length ? Math.max(...marks) : null;
}
function placementFor(allMarks, mark){
  if (!Array.isArray(allMarks) || !allMarks.length || !Number.isFinite(mark)) return null;
  return allMarks.filter(m => m > mark).length + 1;
}
function ordinal(n){ return `${n}.`; }

function renderHtml(data){
  if (!data || !data.found) {
    return '<strong>Historiske resultater er ikke verifisert ennå.</strong><small>Fant ikke forrige utgave av stevnet i World Athletics-kalenderen.</small>';
  }
  const pb = bestOwnMark();
  const place = pb != null ? placementFor(data.allMarks, pb) : null;
  const placeLine = place != null
    ? `<small>Din beste tellende prestasjon (${pb} p) ville gitt ${ordinal(place)} plass i dette stevnet.</small>`
    : '';
  return `<strong>${data.year}: vinner ${data.winnerMark} p · topp 3 snitt ${avg(data.top3)} p · topp 8 snitt ${avg(data.top8)} p</strong><small>Vinner: ${data.winner || 'ukjent'}. <a href="${data.source}" target="_blank" rel="noopener">Se offisielle WA-resultater</a></small>${placeLine}`;
}

window.RankingstevnerMeetHistory = {
  loadingHtml: '<strong>Søker i World Athletics-kalenderen …</strong><small>Henter forrige utgave av stevnet.</small>',
  async htmlAsync(name, date){
    const data = await fetchHistory(name, date);
    return renderHtml(data);
  }
};
})();
