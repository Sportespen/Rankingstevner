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
  const endDate = new Date(refDate.getTime() - 24 * 3600 * 1000);
  const startDate = new Date(refDate.getTime() - 450 * 24 * 3600 * 1000);
  const diagnostics = [];

  const candidates = [];
  const seen = new Set();

  // WA's own calendar-results page is built for finding upcoming meets (it's what
  // meet-search.js searches forward from today) and may not actually honour a past date
  // range at all. The nimarion proxy's flat /competitions feed isn't date-scoped the same
  // way, so it's tried first as a second, independent source of past editions.
  try {
    const r = await fetch('https://worldathletics.nimarion.de/competitions', { headers: { Accept: 'application/json', 'User-Agent': 'Rankingstevner/1.0' } });
    if (r.ok) {
      const data = await r.json();
      for (const x of Array.isArray(data) ? data : []) {
        if (!x?.id || !x?.name || !x?.start) continue;
        const d = parseDate(x.start);
        if (!d || d < startDate || d > endDate) continue;
        const key = `${x.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ id: x.id, name: x.name, start: x.start });
      }
    }
    diagnostics.push({ source: 'nimarion-competitions', count: candidates.length });
  } catch (e) {
    diagnostics.push({ source: 'nimarion-competitions', error: String(e?.message || e) });
  }

  const offsets = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  await Promise.all(offsets.map(async offset => {
    const wa = new URL('https://worldathletics.org/competition/calendar-results');
    wa.searchParams.set('startDate', startDate.toISOString().slice(0, 10));
    wa.searchParams.set('endDate', endDate.toISOString().slice(0, 10));
    wa.searchParams.set('disciplineId', '1');
    // Without this the calendar defaults to listing competitions regardless of whether they
    // have published results (including future ones with none yet), which is presumably why
    // a past-date search was coming back full of unrelated meets instead of completed ones.
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
        candidates.push(row);
      }
    } catch (e) {
      diagnostics.push({ source: 'calendar', offset, error: String(e?.message || e) });
    }
  }));

  const wantedNorm = normalizeMeetName(name);
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
  const matchEvent = events.find(ev => new RegExp(event, 'i').test(String(ev?.discipline || ev?.name || '')));
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
  if (!entries.length) return json({ ok: true, found: false, reason: 'no-valid-marks', diagnostics });

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
