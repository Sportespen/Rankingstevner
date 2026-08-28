// Finds the previous edition of a given meet (by name, searching WA's calendar backwards from
// the upcoming meet's date) and pulls that edition's actual combined-event results, so
// "Historisk nivå" no longer depends on a hand-maintained list of 5 meets.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const name = (url.searchParams.get('name') || '').trim();
  const event = (url.searchParams.get('event') || '').trim();
  const refDateRaw = (url.searchParams.get('date') || '').trim();
  if (!name) return json({ ok: false, error: 'Mangler stevnenavn' }, 400);
  if (event !== 'Decathlon' && event !== 'Heptathlon') return json({ ok: true, found: false, reason: 'not-combined-event' });

  const refDate = parseDate(refDateRaw) || new Date();
  const diagnostics = [];
  const wantedNorm = normalizeMeetName(name);

  // A 450-day blanket lookback turned out to return thousands of unrelated meets (youth
  // championships, marathons) with no sign of a real recurring GL meet anywhere in the first
  // ~1000 - the global calendar is just too dense to page through blindly. Annual meets recur
  // around the same calendar date each year, so search narrow (±30 day) windows centered on
  // that date, one year back at a time, instead of one wide unfocused scan.
  let candidates = [];
  let nimarionAll = null;
  try {
    const r = await fetch('https://worldathletics.nimarion.de/competitions', { headers: { Accept: 'application/json', 'User-Agent': 'Rankingstevner/1.0' } });
    if (r.ok) nimarionAll = await r.json();
    diagnostics.push({ source: 'nimarion-competitions', count: Array.isArray(nimarionAll) ? nimarionAll.length : 0 });
  } catch (e) {
    diagnostics.push({ source: 'nimarion-competitions', error: String(e?.message || e) });
  }

  for (const yearsBack of [1, 2]) {
    const center = new Date(refDate.getTime() - yearsBack * 365 * 24 * 3600 * 1000);
    const windowStart = new Date(center.getTime() - 30 * 24 * 3600 * 1000);
    const windowEnd = new Date(center.getTime() + 30 * 24 * 3600 * 1000);
    const seen = new Set();
    const windowCandidates = [];

    for (const x of Array.isArray(nimarionAll) ? nimarionAll : []) {
      if (!x?.id || !x?.name || !x?.start) continue;
      const d = parseDate(x.start);
      if (!d || d < windowStart || d > windowEnd) continue;
      const key = `${x.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      windowCandidates.push({ id: x.id, name: x.name, start: x.start });
    }

    await Promise.all([0, 100, 200].map(async offset => {
      const wa = new URL('https://worldathletics.org/competition/calendar-results');
      // Without isSearchReset=true the page seems to ignore a custom startDate/endDate and
      // just show its default (upcoming-focused) view - which matches exactly what we saw:
      // a past date range returning generic current/future-ish meets instead of the
      // requested window.
      wa.searchParams.set('isSearchReset', 'true');
      wa.searchParams.set('startDate', windowStart.toISOString().slice(0, 10));
      wa.searchParams.set('endDate', windowEnd.toISOString().slice(0, 10));
      wa.searchParams.set('disciplineId', '1');
      wa.searchParams.set('hideCompetitionsWithNoResults', 'true');
      if (offset) wa.searchParams.set('offset', String(offset));
      try {
        const r = await fetch(wa.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } });
        if (!r.ok) return;
        const html = await r.text();
        for (const row of extractCalendarObjects(html)) {
          if (!row.id || !row.name || !row.start) continue;
          const key = `${row.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          windowCandidates.push(row);
        }
      } catch (e) {
        diagnostics.push({ source: 'calendar', yearsBack, offset, error: String(e?.message || e) });
      }
    }));

    diagnostics.push({ source: 'window', yearsBack, windowStart: windowStart.toISOString().slice(0, 10), windowEnd: windowEnd.toISOString().slice(0, 10), candidateCount: windowCandidates.length, sampleNames: windowCandidates.slice(0, 8).map(c => c.name) });
    candidates = candidates.concat(windowCandidates);
    if (windowCandidates.some(c => nameScore(wantedNorm, normalizeMeetName(c.name)) > 0)) break;
  }

  const scored = candidates
    .map(c => ({ c, score: nameScore(wantedNorm, normalizeMeetName(c.name)) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.c.start) - new Date(a.c.start));

  const rawNameHits = candidates.filter(c => normalizeMeetName(c.name).includes(wantedNorm.split(' ')[0] || ' ')).slice(0, 5).map(c => ({ name: c.name, start: c.start, id: c.id }));
  diagnostics.push({
    source: 'match',
    candidateCount: candidates.length,
    wantedNorm,
    topMatches: scored.slice(0, 3).map(x => ({ name: x.c.name, score: x.score, start: x.c.start, id: x.c.id })),
    rawNameHits,
    sampleCandidateNames: candidates.slice(0, 8).map(c => c.name)
  });

  const best = scored[0]?.c;
  if (!best) return json({ ok: true, found: false, reason: 'no-previous-edition-found', diagnostics });

  let resultsData = null;
  try {
    const r = await fetch(`https://worldathletics.nimarion.de/competitions/${best.id}/results`, { headers: { Accept: 'application/json', 'User-Agent': 'Rankingstevner/1.0' } });
    if (r.ok) resultsData = await r.json();
    diagnostics.push({ source: 'results', competitionId: best.id, status: r.status });
  } catch (e) {
    diagnostics.push({ source: 'results', competitionId: best.id, error: String(e?.message || e) });
  }
  const events = Array.isArray(resultsData?.events) ? resultsData.events : [];
  // Temporary while the /results shape is unverified: if there's no events array at all,
  // show what top-level keys the response actually has instead of just failing silently.
  if (!events.length) {
    diagnostics.push({ source: 'results-shape', topLevelKeys: resultsData && typeof resultsData === 'object' ? Object.keys(resultsData) : typeof resultsData, sample: resultsData ? JSON.stringify(resultsData).slice(0, 500) : null });
  } else {
    diagnostics.push({ source: 'results-shape', eventCount: events.length, events: events.slice(0, 30).map(ev => ({ id: ev?.id ?? ev?.eventId ?? null, discipline: ev?.discipline || ev?.name || null })) });
  }
  // WA's own results-page URLs use a fixed eventId per discipline regardless of which
  // competition it is (confirmed: eventId 10229629/10229536 appear for both Décastar and
  // Hypomeeting's Decathlon/Heptathlon) - match on that id first since it's exact, falling
  // back to matching the discipline name in case nimarion's ids don't line up with WA's own.
  const WA_EVENT_ID = { Decathlon: 10229629, Heptathlon: 10229536 };
  const wantedId = WA_EVENT_ID[event];
  const matchEvent = events.find(ev => Number(ev?.id ?? ev?.eventId) === wantedId)
    || events.find(ev => new RegExp(event, 'i').test(String(ev?.discipline || ev?.name || '')));
  if (!matchEvent) return json({ ok: true, found: false, reason: 'event-not-in-results', diagnostics });

  const entries = [];
  for (const race of matchEvent.races || []) {
    for (const r of race?.results || []) {
      const mark = Number(r?.mark);
      if (!Number.isFinite(mark) || mark <= 0) continue;
      const athlete = Array.isArray(r?.athletes) ? r.athletes[0] : r?.athlete;
      const athleteName = athleteDisplayName(athlete);
      entries.push({ place: Number(r?.place) || null, mark, name: athleteName });
    }
  }
  if (!entries.length) {
    diagnostics.push({
      source: 'entries-shape',
      raceCount: Array.isArray(matchEvent.races) ? matchEvent.races.length : 0,
      matchEventKeys: Object.keys(matchEvent || {}),
      sampleRace: matchEvent?.races?.[0] ? JSON.stringify(matchEvent.races[0]).slice(0, 800) : null
    });
    return json({ ok: true, found: false, reason: 'no-valid-marks', diagnostics });
  }

  entries.sort((a, b) => b.mark - a.mark);
  const marks = entries.map(e => e.mark);
  const winner = entries[0];
  const year = parseDate(best.start)?.getUTCFullYear() || null;

  return json({
    ok: true,
    found: true,
    year,
    winner: winner.name || null,
    winnerMark: winner.mark,
    top3: marks.slice(0, 3),
    top8: marks.slice(0, 8),
    allMarks: marks,
    competitionId: best.id,
    eventId: matchEvent.id || null,
    source: matchEvent.id ? `https://worldathletics.org/competition/calendar-results/results/${best.id}?eventId=${matchEvent.id}` : `https://worldathletics.org/competition/calendar-results/results/${best.id}`,
    matchedMeetName: best.name,
    diagnostics
  });
}

function athleteDisplayName(a) {
  if (!a) return null;
  if (a.name) return String(a.name);
  if (a.fullName) return String(a.fullName);
  const first = a.firstName || a.firstname || '';
  const last = a.lastName || a.lastname || '';
  const full = `${first} ${last}`.trim();
  return full || null;
}
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}
// Meet series names are stable year to year ("Décastar", "Hypo-Meeting") - strip the parts
// that change (years, diacritics, punctuation) so "Décastar 2025" matches "Decastar 2026".
function normalizeMeetName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function nameScore(wanted, candidate) {
  if (!wanted || !candidate) return 0;
  if (wanted === candidate) return 3;
  if (candidate.includes(wanted) || wanted.includes(candidate)) return 2;
  const wantedWords = new Set(wanted.split(' ').filter(w => w.length > 2));
  const candWords = candidate.split(' ').filter(w => w.length > 2);
  const overlap = candWords.filter(w => wantedWords.has(w)).length;
  return overlap >= 2 ? 1 : 0;
}
function decode(v) { return String(v || '').replace(/\\u0026/g, '&').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'); }
function walk(v, out) {
  if (!v) return;
  if (Array.isArray(v)) { for (const x of v) walk(x, out); return; }
  if (typeof v !== 'object') return;
  const name = v.name || v.competitionName;
  const start = v.startDate || v.start;
  if (name && start && (v.disciplines || v.rankingCategory || v.venue)) {
    out.push({ id: v.id || v.competitionId || null, name, start });
  }
  for (const x of Object.values(v)) walk(x, out);
}
function extractCalendarObjects(html) {
  const out = [];
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) { try { walk(JSON.parse(decode(m[1])), out); } catch (_) {} }
  if (out.length) return out;
  const text = decode(html).replace(/\\"/g, '"');
  const re = /\{[^{}]{0,2500}"(?:id|competitionId)"\s*:\s*(\d+)[^{}]{0,2500}"name"\s*:\s*"([^"]+)"[^{}]{0,2500}"startDate"\s*:\s*"([^"]+)"[^{}]*\}/g;
  let z;
  while ((z = re.exec(text))) out.push({ id: Number(z[1]), name: z[2], start: z[3] });
  return out;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=21600' } });
}
