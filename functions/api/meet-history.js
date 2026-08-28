// Finds the previous edition of a given meet (by name, searching WA's calendar backwards from
// the upcoming meet's date) and pulls that edition's actual combined-event results, so
// "Historisk nivå" no longer depends on a hand-maintained list of 5 meets.
// Manually researched via web search (worldathletics.org itself isn't reachable from this
// dev environment to verify the live lookup end to end) and checked before it, for the major
// Combined Events Tour meets/championships where a confident result was actually findable.
// Smaller domestic/junior meets mostly aren't indexed anywhere searchable - those fall
// through to the live lookup below, which correctly reports "not verified" rather than guess.
const VERIFIED = [
  { match: /d[ée]castar/i, event: 'Decathlon', year: 2025, winner: 'Ayden Owens-Delerme', winnerMark: 8478, top: [8478, 8236, 8177, 8123, 8102, 8020, 7994, 7903], source: 'https://worldathletics.org/competition/calendar-results/results/7196994?eventId=10229629' },
  { match: /d[ée]castar/i, event: 'Heptathlon', year: 2025, winner: 'Martha Araujo', winnerMark: 6451, top: [6451, 6365, 6283, 6271, 6195, 6190, 6083, 6017], source: 'https://worldathletics.org/competition/calendar-results/results/7196994?eventId=10229536' },
  { match: /hypo-?meeting|g[öo]tzis/i, event: 'Decathlon', year: 2025, winner: 'Sander Skotheim', winnerMark: 8909, top: [8909, 8626, 8575, 8575, 8555, 8527], source: 'https://worldathletics.org/competitions/world-athletics-combined-events-tour/news/hypo-meeting-gotzis-2025' },
  { match: /hypo-?meeting|g[öo]tzis/i, event: 'Heptathlon', year: 2025, winner: 'Anna Hall', winnerMark: 7032, top: [7032, 6576, 6475], source: 'https://worldathletics.org/competitions/world-athletics-combined-events-tour/news/hypo-meeting-gotzis-2025' },
  { match: /multistars|brescia/i, event: 'Decathlon', year: 2025, winner: 'Lewis Church', winnerMark: 8067, top: [8067, 7899, 7885], source: 'https://www.watchathletics.com/article/13345/church-and-slocka-win-the-multistars' },
  { match: /multistars|brescia/i, event: 'Heptathlon', year: 2025, winner: 'Julia Slocka', winnerMark: 5840, top: [5840], source: 'https://www.watchathletics.com/article/13345/church-and-slocka-win-the-multistars' },
  { match: /ratingen/i, event: 'Decathlon', year: 2026, winner: 'Leo Neugebauer', winnerMark: 8573, top: [8573, 8458, 8402], source: 'https://worldathletics.org/news/report/stadtwerke-ratingen-mehrkampf-2026' },
  { match: /arona|pruebas combinadas/i, event: 'Decathlon', year: 2025, winner: 'Antoine Ferranti', winnerMark: 8221, top: [8221, 7972, 7889, 7826, 7804, 7722, 7501, 7453], source: 'https://worldathletics.org/competition/calendar-results/results/7216692?day=2' },
  // Deliberately excludes "U23" so it never matches the separate German U23 Combined Events
  // Championships, whose result wasn't findable via search - that one falls through live.
  { match: /^(?!.*u23)(?=.*german)(?=.*championships).*$/i, event: 'Decathlon', year: 2025, winner: 'Tim Nowak', winnerMark: 8140, top: [8140, 7579, 7510, 7338, 7226, 6998, 6907, 6872], source: 'https://worldathletics.org/competition/calendar-results/results/7229381?day=2' },
  { match: /czapiewski/i, event: 'Decathlon', year: 2025, winner: 'Ondřej Kopecký', winnerMark: 8254, top: [8254, 8136, 8107], source: 'https://worldathletics.org/competition/calendar-results/results/7223230?eventId=10229629' },
  { match: /czapiewski/i, event: 'Heptathlon', year: 2025, winner: 'Adrianna Sułek-Schubert', winnerMark: 6287, top: [6287, 6249, 6159], source: 'https://worldathletics.org/competition/calendar-results/results/7223230?eventId=10229536' },
  // Indoor combined events - this app files men's indoor (also called Heptathlon in real WA
  // terminology) under the same 'Decathlon' code it uses for men outdoors, and women's indoor
  // Pentathlon under 'Heptathlon' - matching how target-score.js already picks the event code
  // purely by sex, not by season.
  { match: /tallinn/i, event: 'Decathlon', year: 2026, winner: 'Rasmus Roosleht', winnerMark: 6045, top: [6045], source: 'https://www.european-athletics.com/home/news/roosleht-and-szucs-win-at-tallinn-combined-event-meeting' },
  { match: /tallinn/i, event: 'Heptathlon', year: 2026, winner: 'Szabina Szucs', winnerMark: 4494, top: [4494], source: 'https://www.european-athletics.com/home/news/roosleht-and-szucs-win-at-tallinn-combined-event-meeting' },
  // Exact match only (not just "european athletics...championships") so this never matches
  // European Athletics U23 Championships or a future outdoor edition - those are different
  // meets with their own results.
  { match: /^european athletics indoor championships$/i, event: 'Decathlon', year: 2025, winner: 'Sander Skotheim', winnerMark: 6558, top: [6558], source: 'https://www.european-athletics.com/home/news/skotheim-wins-epic-heptathlon-with-european-record' },
  { match: /^european athletics indoor championships$/i, event: 'Heptathlon', year: 2025, winner: 'Saga Vanninen', winnerMark: 4922, top: [4922], source: 'https://www.european-athletics.com/home/news/vanninen-leads-hard-fought-pentathlon-after-three-events' },
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const name = (url.searchParams.get('name') || '').trim();
  const event = (url.searchParams.get('event') || '').trim();
  const refDateRaw = (url.searchParams.get('date') || '').trim();
  if (!name) return json({ ok: false, error: 'Mangler stevnenavn' }, 400);
  if (event !== 'Decathlon' && event !== 'Heptathlon') return json({ ok: true, found: false, reason: 'not-combined-event' });

  const verified = VERIFIED.find(v => v.event === event && v.match.test(name));
  if (verified) {
    return json({
      ok: true, found: true, year: verified.year, winner: verified.winner, winnerMark: verified.winnerMark,
      top3: verified.top.slice(0, 3), top8: verified.top, allMarks: verified.top,
      source: verified.source, matchedMeetName: name,
      diagnostics: [{ source: 'verified-table' }]
    });
  }

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

  // Small domestic/regional championships often don't run on a fixed weekend from year to
  // year (unlike GL Tour meets), so a ±30 day window missed some real editions. Widened to
  // ±45 days, and a 3rd yearsBack pass added for meets on a longer or irregular cycle.
  for (const yearsBack of [1, 2, 3]) {
    const center = new Date(refDate.getTime() - yearsBack * 365 * 24 * 3600 * 1000);
    const windowStart = new Date(center.getTime() - 45 * 24 * 3600 * 1000);
    const windowEnd = new Date(center.getTime() + 45 * 24 * 3600 * 1000);
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
      // regionId=3&regionType=area is WA's own Europe filter (confirmed on the site itself) -
      // narrows the candidate pool a lot, same reasoning as meet-search.js.
      wa.searchParams.set('regionId', '3');
      wa.searchParams.set('regionType', 'area');
      wa.searchParams.set('disciplineId', '1');
      // hideCompetitionsWithNoResults=true was dropped here: WA's own "has results" flag looks
      // unreliable for smaller/domestic federations - a meet can be missing that flag while its
      // results page is actually populated (this is consistent with those same meets' results
      // never turning up in generic web search either - the data quality gap is on WA's side,
      // not just search indexing). Keeping the filter meant those meets' previous editions were
      // silently dropped from the candidate list before name-matching ever got a chance to run.
      // A wrongly-included candidate just falls through to "no-standings-found" below, so
      // dropping the filter can only add candidates, never break an existing match.
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

  // nimarion's /competitions/{id}/results only mirrors WA's per-discipline results (100m,
  // Long Jump, Shot Put, ... each as its own event) - the computed final combined-event
  // standings with total points don't appear anywhere in that JSON (verified: neither
  // eventId 10229629 nor 10229536 ever showed up there). That aggregated table only seems to
  // be server-rendered on WA's own results page, so scrape that page directly instead.
  const WA_EVENT_ID = { Decathlon: 10229629, Heptathlon: 10229536 };
  const wantedId = WA_EVENT_ID[event];
  const resultsUrl = new URL(`https://worldathletics.org/competition/calendar-results/results/${best.id}`);
  resultsUrl.searchParams.set('eventId', String(wantedId));

  let html = '';
  try {
    const r = await fetch(resultsUrl.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } });
    if (r.ok) html = await r.text();
    diagnostics.push({ source: 'wa-results-page', url: resultsUrl.toString(), status: r.status, htmlLength: html.length });
  } catch (e) {
    diagnostics.push({ source: 'wa-results-page', url: resultsUrl.toString(), error: String(e?.message || e) });
  }

  const rows = extractCombinedEventStandings(html);
  if (!rows.length) {
    // Temporary while this page's embedded data shape is unverified: show enough of the
    // __NEXT_DATA__ payload (or its absence) to see what's actually there.
    const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    diagnostics.push({
      source: 'wa-results-shape',
      hasNextData: !!m,
      nextDataLength: m ? m[1].length : 0,
      nextDataSample: m ? decode(m[1]).slice(0, 1500) : null,
      htmlSample: !m ? html.slice(0, 800) : null
    });
    return json({ ok: true, found: false, reason: 'no-standings-found', diagnostics });
  }

  rows.sort((a, b) => b.mark - a.mark);
  const marks = rows.map(r => r.mark);
  const winner = rows[0];
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
    eventId: wantedId,
    source: resultsUrl.toString(),
    matchedMeetName: best.name,
    diagnostics
  });
}

// A combined-event standings row looks like {place/rank, athlete name, total points} - the
// point total for a senior decathlon/heptathlon is reliably in the 1000s (roughly 3000-9500),
// which is a distinctive enough range to tell it apart from individual-event marks (seconds,
// metres, centimetres) without knowing the exact field names in advance.
function extractCombinedEventStandings(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  let data;
  try { data = JSON.parse(decode(m[1])); } catch (_) { return []; }
  const out = [];
  const seen = new Set();
  walkResults(data, out, seen);
  return out;
}
function walkResults(v, out, seen) {
  if (!v) return;
  if (Array.isArray(v)) { for (const x of v) walkResults(x, out, seen); return; }
  if (typeof v !== 'object') return;
  const place = Number(v.place ?? v.rank ?? v.position);
  const markRaw = v.total ?? v.points ?? v.score ?? v.mark;
  const mark = Number(markRaw);
  if (Number.isFinite(place) && place > 0 && Number.isFinite(mark) && mark >= 2000 && mark <= 9999) {
    const name = athleteDisplayName(v.athlete) || athleteDisplayName(v.competitor) || athleteDisplayName(v.person) || athleteDisplayName(v) || guessNameField(v);
    const key = `${place}|${mark}|${name || ''}`;
    if (!seen.has(key)) { seen.add(key); out.push({ place, mark, name, _rawKeys: name ? undefined : Object.keys(v) }); }
  }
  for (const x of Object.values(v)) walkResults(x, out, seen);
}
function athleteDisplayName(a) {
  if (!a || typeof a !== 'object') return null;
  if (typeof a.name === 'string') return a.name;
  if (typeof a.fullName === 'string') return a.fullName;
  if (typeof a.athleteName === 'string') return a.athleteName;
  if (typeof a.competitorName === 'string') return a.competitorName;
  if (typeof a.displayName === 'string') return a.displayName;
  const first = a.firstName || a.firstname || '';
  const last = a.lastName || a.lastname || '';
  const full = `${first} ${last}`.trim();
  return full || null;
}
// Last-resort guess when none of the known field names match: a person's name in this data
// is reliably "letters/spaces/hyphens, 4-60 chars, at least two words" - distinct enough from
// country codes, dates, or venue strings to be a safe enough heuristic for a display label.
function guessNameField(v) {
  for (const [key, val] of Object.entries(v)) {
    if (typeof val !== 'string') continue;
    if (/^[\p{L}][\p{L}'.\- ]{3,59}$/u.test(val) && val.trim().includes(' ') && !/^\d+$/.test(val)) return val;
  }
  return null;
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
    // Many German/Austrian/Swiss championships are named with a leading edition ordinal
    // ("58. Nordrhein-Meisterschaften ...") that increments every year - left in, it would
    // break substring matching against the same meet a year later since "58" never equals "59".
    .replace(/^\s*\d+\.\s*/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
// Word-overlap scoring used to also award a weak match for 2+ shared words - which is exactly
// how "German U23 Combined Events Championships" got matched to a wholly different country's
// meet (they share "combined events championships", generic words that appear in dozens of
// different national championships). A wrong match here means linking to another country's
// official results, which is worse than admitting no match was found - so a match now requires
// full-string equality/containment, OR (below) every distinguishing word of the shorter name
// individually accounted for in the other - never just some of them.
//
// That second tier exists because names get abbreviated inconsistently between editions - a
// live diagnostics dump showed a meet whose current name reads "... Int.le ... Atl. etica ..."
// (European meets commonly punctuate abbreviations like "Int.le" for "Internazionale"), which
// after punctuation is collapsed to spaces normalizes to the separate tokens "int"/"le" and
// "atl"/"etica" - neither a substring of a previous edition's fully spelled-out "internazionale"
// / "atletica". Filtering out short connective words (di/le/a/of/...) via a length>=3 cutoff and
// requiring every remaining token of the shorter name to prefix-match a distinct token of the
// longer one - not merely intersect - keeps this from reopening the German/Austria bug: that
// pair only ever shared generic words ("combined","events","championships"), never a country
// name, so full coverage of the shorter list still fails for it (see tests run before shipping).
function meaningfulTokens(norm) {
  return norm.split(' ').filter(w => w.length >= 3);
}
function tokensMatch(shortTokens, longTokens) {
  if (!shortTokens.length) return false;
  const used = new Array(longTokens.length).fill(false);
  for (const sw of shortTokens) {
    let matched = false;
    for (let i = 0; i < longTokens.length; i++) {
      if (used[i]) continue;
      const lw = longTokens[i];
      if (lw === sw || lw.startsWith(sw) || sw.startsWith(lw)) { used[i] = true; matched = true; break; }
    }
    if (!matched) return false;
  }
  return true;
}
function nameScore(wanted, candidate) {
  if (!wanted || !candidate) return 0;
  if (wanted === candidate) return 4;
  if (candidate.includes(wanted) || wanted.includes(candidate)) return 3;
  const a = meaningfulTokens(wanted), b = meaningfulTokens(candidate);
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 2 && tokensMatch(shorter, longer)) return 1;
  return 0;
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
// This lookup's matching logic is still being actively fixed based on live diagnostics -
// a 6-hour edge cache (the previous setting) meant a "not found" response from before a fix
// kept being served by Cloudflare for hours after the fix was deployed, making it look like
// nothing had changed. "found:true" results are cheap to recompute and can change too (a fixed
// name-extraction bug should show up immediately), so nothing here is cached at the edge for
// now; revisit once the matching/extraction logic has stopped changing week to week.
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
