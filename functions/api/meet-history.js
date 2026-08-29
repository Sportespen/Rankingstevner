// Finds the previous edition of a given meet (by name, searching WA's calendar backwards from
// the upcoming meet's date) and pulls that edition's actual combined-event results, so
// "Historisk nivå" no longer depends on a hand-maintained list of 5 meets.
// Manually researched via web search (worldathletics.org itself isn't reachable from this
// dev environment to verify the live lookup end to end) and checked before it, for the major
// Combined Events Tour meets/championships where a confident result was actually findable.
// Smaller domestic/junior meets mostly aren't indexed anywhere searchable - those fall
// through to the live lookup below, which correctly reports "not verified" rather than guess.
const VERIFIED = [
  // No confirmed WA competition ID found for this one yet (unlike Multistars/Ratingen below) -
  // stays hand-researched until one turns up.
  { match: /hypo-?meeting|g[öo]tzis/i, event: 'Decathlon', year: 2025, winner: 'Sander Skotheim', winnerMark: 8909, top: [8909, 8626, 8575, 8575, 8555, 8527], source: 'https://worldathletics.org/competitions/world-athletics-combined-events-tour/news/hypo-meeting-gotzis-2025' },
  { match: /hypo-?meeting|g[öo]tzis/i, event: 'Heptathlon', year: 2025, winner: 'Anna Hall', winnerMark: 7032, top: [7032, 6576, 6475], source: 'https://worldathletics.org/competitions/world-athletics-combined-events-tour/news/hypo-meeting-gotzis-2025' },
];

// Meets whose exact WA competition ID is already known from manual research (this session's own
// network access is blocked, so WebSearch was the only tool available - and it only ever
// returns page titles and prose summaries, never a results page's actual table, capping every
// hand-researched entry at whatever a news article happened to report - usually just the
// podium). Rather than keep those partial numbers as the final answer, these skip straight to
// fetching+parsing the real results page by its known ID - no calendar-search/name-matching
// needed since the ID is already confirmed - which the DEPLOYED function can do since it has
// real, unblocked network access. Falls back to the hand-researched partial data only if that
// live fetch/parse fails, so a temporary WA hiccup can't regress below what's already confirmed.
// Confirmed via a user-provided European Athletics results link for Tallinn (eventId 10229571,
// not the 10229629 used for outdoor Decathlon): WA/EA assigns indoor men's combined events
// ("Heptathlon Short Track") a DISTINCT eventId from outdoor Decathlon - they are not the same
// discipline in WA's own data model, even though this app pools them under one internal code
// for ranking purposes. This affects every indoor meet's live lookup, not just Tallinn - try
// each known candidate in turn and use whichever one's results page actually has standings,
// rather than assuming a single fixed ID.
const EVENT_ID_CANDIDATES = {
  // 10229630, previously listed here as an "alt id" guessed from search context, is actually WA's
  // global id for Men's 100 Metres - confirmed directly from two live diagnostics dumps (North
  // Macedonian Championships and German U23 Championships), both showing
  // "event":"Men's 100 Metres","eventId":10229630 in the raw page data. It only ever showed up in
  // search results because the 100m is also part of every decathlon program, not because it's a
  // decathlon variant. Removed - it could never have matched real combined-event standings
  // anyway (individual sprint times don't fall in the 2000-9999 point-total range this app looks
  // for), so this wasn't a correctness risk, just a wasted fetch and a wrong comment.
  Decathlon: [10229629, 10229571], // outdoor Decathlon, indoor Heptathlon Short Track (both confirmed live)
  // outdoor Heptathlon (women, confirmed), then two unconfirmed candidates for indoor Pentathlon
  // Short Track (WA's own toplist naming confirms that discipline exists, "Pentathlon Short
  // Track - women", but not yet which numeric id it uses) - trying an extra wrong id here is
  // low-risk: extractCombinedEventStandings only ever accepts rows shaped like real combined-
  // event standings (a place plus a 2000-9999 point total), so an unrelated event's page won't
  // get mistaken for the right one.
  Heptathlon: [10229536, 10229581, 10229527],
};
const KNOWN_COMPETITION = [
  // These already had a full/near-full hand-researched top8 (their competition ID was sitting
  // right there in the old VERIFIED source URL), but a frozen snapshot from whatever a search
  // happened to surface is worse than the live page once the live path actually works - it can
  // only get MORE complete over time as WA's own page does, never less.
  { match: /d[ée]castar/i, event: 'Decathlon', competitionId: 7196994, year: 2025, fallback: { winner: 'Ayden Owens-Delerme', winnerMark: 8478, top: [8478, 8236, 8177, 8123, 8102, 8020, 7994, 7903], source: 'https://worldathletics.org/competition/calendar-results/results/7196994?eventId=10229629' } },
  { match: /d[ée]castar/i, event: 'Heptathlon', competitionId: 7196994, year: 2025, fallback: { winner: 'Martha Araujo', winnerMark: 6451, top: [6451, 6365, 6283, 6271, 6195, 6190, 6083, 6017], source: 'https://worldathletics.org/competition/calendar-results/results/7196994?eventId=10229536' } },
  { match: /arona|pruebas combinadas/i, event: 'Decathlon', competitionId: 7216692, year: 2025, fallback: { winner: 'Antoine Ferranti', winnerMark: 8221, top: [8221, 7972, 7889, 7826, 7804, 7722, 7501, 7453], source: 'https://worldathletics.org/competition/calendar-results/results/7216692?day=2' } },
  { match: /multistars|brescia/i, event: 'Decathlon', competitionId: 7219377, year: 2025, fallback: { winner: 'Lewis Church', winnerMark: 8067, top: [8067, 7899, 7885], source: 'https://www.watchathletics.com/article/13345/church-and-slocka-win-the-multistars' } },
  { match: /multistars|brescia/i, event: 'Heptathlon', competitionId: 7219377, year: 2025, fallback: { winner: 'Julia Slocka', winnerMark: 5840, top: [5840], source: 'https://www.watchathletics.com/article/13345/church-and-slocka-win-the-multistars' } },
  { match: /ratingen/i, event: 'Decathlon', competitionId: 7230559, year: 2026, fallback: { winner: 'Leo Neugebauer', winnerMark: 8573, top: [8573, 8458, 8402], source: 'https://worldathletics.org/news/report/stadtwerke-ratingen-mehrkampf-2026' } },
  // Deliberately excludes "U23" so it never matches the separate German U23 Combined Events
  // Championships, which is a different meet with its own results.
  { match: /^(?!.*u23)(?=.*german)(?=.*championships).*$/i, event: 'Decathlon', competitionId: 7229381, year: 2025, fallback: { winner: 'Tim Nowak', winnerMark: 8140, top: [8140, 7579, 7510, 7338, 7226, 6998, 6907, 6872], source: 'https://worldathletics.org/competition/calendar-results/results/7229381?day=2' } },
  // The U23-specific meet, found separately (competition ID 7229280) - no fallback data found
  // via search for this one, so it depends entirely on the live fetch succeeding.
  { match: /german.*u23.*combined events championships/i, event: 'Decathlon', competitionId: 7229280, year: 2025 },
  // North Macedonian Championships intentionally NOT listed here: the competition id found
  // earlier this session (7187813) turned out via live diagnostics to be a stale 2022 edition,
  // not 2025 - pointing this app at it would eventually have shown 3-year-old results labelled
  // as current. Left to the standard calendar-search path instead, which date-windows properly.
  { match: /czapiewski/i, event: 'Decathlon', competitionId: 7223230, year: 2025, fallback: { winner: 'Ondřej Kopecký', winnerMark: 8254, top: [8254, 8136, 8107], source: 'https://worldathletics.org/competition/calendar-results/results/7223230?eventId=10229629' } },
  { match: /czapiewski/i, event: 'Heptathlon', competitionId: 7223230, year: 2025, fallback: { winner: 'Adrianna Sułek-Schubert', winnerMark: 6287, top: [6287, 6249, 6159], source: 'https://worldathletics.org/competition/calendar-results/results/7223230?eventId=10229536' } },
  { match: /tallinn/i, event: 'Decathlon', competitionId: 7230385, year: 2026, fallback: { winner: 'Rasmus Roosleht', winnerMark: 6045, top: [6045, 5812], source: 'https://www.european-athletics.com/home/news/roosleht-and-szucs-win-at-tallinn-combined-event-meeting' } },
  { match: /tallinn/i, event: 'Heptathlon', competitionId: 7230385, year: 2026, fallback: { winner: 'Szabina Szucs', winnerMark: 4494, top: [4494, 4439, 4416], source: 'https://www.european-athletics.com/home/news/roosleht-and-szucs-win-at-tallinn-combined-event-meeting' } },
  // Exact match only (not just "european athletics...championships") so this never matches
  // European Athletics U23 Championships or a future outdoor edition - those are different
  // meets with their own results.
  { match: /^european athletics indoor championships$/i, event: 'Decathlon', competitionId: 7173256, year: 2025, fallback: { winner: 'Sander Skotheim', winnerMark: 6558, top: [6558, 6506, 6388, 6380], source: 'https://www.european-athletics.com/home/news/skotheim-wins-epic-heptathlon-with-european-record' } },
  { match: /^european athletics indoor championships$/i, event: 'Heptathlon', competitionId: 7173256, year: 2025, fallback: { winner: 'Saga Vanninen', winnerMark: 4922, top: [4922, 4826, 4781], source: 'https://www.european-athletics.com/home/news/vanninen-leads-hard-fought-pentathlon-after-three-events' } },
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

  const known = KNOWN_COMPETITION.find(k => k.event === event && k.match.test(name));
  if (known) return await resolveKnownCompetition(known, event, name);

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
  // standings with total points don't appear anywhere in that JSON. That aggregated table only
  // seems to be server-rendered on WA's own results page, so scrape that page directly instead.
  const fetched = await fetchStandingsForCompetition(best.id, event);
  diagnostics.push(...fetched.diagnostics);
  if (!fetched.rows.length) return json({ ok: true, found: false, reason: 'no-standings-found', diagnostics });

  fetched.rows.sort((a, b) => b.mark - a.mark);
  const marks = fetched.rows.map(r => r.mark);
  const winner = fetched.rows[0];
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
    eventId: fetched.eventId,
    source: fetched.resultsUrl,
    matchedMeetName: best.name,
    diagnostics
  });
}

// Tries each candidate eventId in turn against a competition's WA results page, returning the
// first one whose page actually has combined-event standings. Shared by the calendar-search
// path above and the known-competition-ID path below, since both need the same "which eventId
// is this meet's discipline actually filed under" resolution.
async function fetchStandingsForCompetition(competitionId, event) {
  // Confirmed via a user-provided worldathletics.org link
  // (results/7230385?eventId=10229571&gender=M) that WA's own URL structure includes an
  // explicit gender param alongside eventId - this app already knows the athlete's sex from
  // which internal code is being looked up (Decathlon=men, Heptathlon=women), so pass it
  // through rather than relying on the page defaulting to the right one without it.
  const gender = event === 'Decathlon' ? 'M' : 'W';
  const diagnostics = [];
  for (const eventId of EVENT_ID_CANDIDATES[event] || []) {
    const resultsUrl = new URL(`https://worldathletics.org/competition/calendar-results/results/${competitionId}`);
    resultsUrl.searchParams.set('eventId', String(eventId));
    resultsUrl.searchParams.set('gender', gender);
    let html = '';
    try {
      const r = await fetch(resultsUrl.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } });
      if (r.ok) html = await r.text();
      diagnostics.push({ source: 'wa-results-page', url: resultsUrl.toString(), eventId, status: r.status, htmlLength: html.length });
    } catch (e) {
      diagnostics.push({ source: 'wa-results-page', url: resultsUrl.toString(), eventId, error: String(e?.message || e) });
      continue;
    }
    const rows = extractCombinedEventStandings(html);
    if (rows.length) return { rows, eventId, resultsUrl: resultsUrl.toString(), diagnostics };
    // Temporary while this page's embedded data shape is unverified: show enough of the
    // __NEXT_DATA__ payload (or its absence) to see what's actually there.
    const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    diagnostics.push({
      source: 'wa-results-shape', eventId, hasNextData: !!m,
      nextDataLength: m ? m[1].length : 0,
      nextDataSample: m ? decode(m[1]).slice(0, 800) : null,
      htmlSample: !m ? html.slice(0, 500) : null
    });
  }
  // For a dedicated combined-events meet (Décastar, Tallinn, ...) the eventId candidates above
  // are enough - the competition IS the combined event. But a general multi-day national
  // championships (German U23, North Macedonian - both confirmed via live diagnostics) files
  // dozens of individual disciplines under its own competition-specific eventIds that don't
  // follow the global pattern (their 10229629 request came back 500, meaning that id isn't even
  // registered for that competition), so guessing further global ids doesn't scale. Querying by
  // day instead - the same ?day=N shape this app's own original German Championships research
  // URL used - asks WA's page for everything happening that day, which includes the decathlon if
  // it's contested then, without needing that competition's specific eventId at all.
  for (const day of [1, 2, 3, 4]) {
    const resultsUrl = new URL(`https://worldathletics.org/competition/calendar-results/results/${competitionId}`);
    resultsUrl.searchParams.set('day', String(day));
    resultsUrl.searchParams.set('gender', gender);
    let html = '';
    try {
      const r = await fetch(resultsUrl.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } });
      if (r.ok) html = await r.text();
      diagnostics.push({ source: 'wa-results-page-by-day', url: resultsUrl.toString(), day, status: r.status, htmlLength: html.length });
    } catch (e) {
      diagnostics.push({ source: 'wa-results-page-by-day', url: resultsUrl.toString(), day, error: String(e?.message || e) });
      continue;
    }
    const rows = extractCombinedEventStandings(html);
    if (rows.length) return { rows, eventId: null, resultsUrl: resultsUrl.toString(), diagnostics };
    // A day page can be huge (hundreds of KB, every discipline held that day) - dumping a raw
    // text sample like the eventId loop does would be unreadable. Pulling out just the distinct
    // "event" name strings shows directly whether Decathlon/Heptathlon is even on that day at
    // all, which is the actual question, without needing the full payload.
    const eventNames = [...new Set([...html.matchAll(/"event"\s*:\s*"([^"]+)"/g)].map(m => m[1]))];
    diagnostics.push({ source: 'wa-results-day-shape', day, eventNamesFound: eventNames.slice(0, 40) });
  }
  return { rows: [], eventId: null, resultsUrl: null, diagnostics };
}

// Fetches+parses the real results page directly for a meet whose WA competition ID is already
// known, bypassing the calendar-search/name-matching entirely - see KNOWN_COMPETITION's comment
// for why. Falls back to the hand-researched partial data if the live fetch/parse comes back
// empty, so this can only add depth, never regress below what was already confirmed. `fallback`
// is optional - some known-ID entries (a competition ID confirmed via search, but with no
// findable news coverage of its own) have nothing to fall back to, so "not found" if the live
// fetch fails there, same as if the ID had never been known at all.
async function resolveKnownCompetition(known, event, name) {
  const fetched = await fetchStandingsForCompetition(known.competitionId, event);
  if (fetched.rows.length) {
    fetched.rows.sort((a, b) => b.mark - a.mark);
    const marks = fetched.rows.map(r => r.mark);
    const winner = fetched.rows[0];
    return json({
      ok: true, found: true, year: known.year, winner: winner.name || known.fallback?.winner || null, winnerMark: winner.mark,
      top3: marks.slice(0, 3), top8: marks.slice(0, 8), allMarks: marks,
      competitionId: known.competitionId, eventId: fetched.eventId, source: fetched.resultsUrl, matchedMeetName: name,
      diagnostics: [...fetched.diagnostics, { source: 'known-competition-live' }]
    });
  }

  if (!known.fallback) return json({ ok: true, found: false, reason: 'known-competition-no-standings', diagnostics: fetched.diagnostics });

  return json({
    ok: true, found: true, year: known.year, winner: known.fallback.winner, winnerMark: known.fallback.winnerMark,
    top3: known.fallback.top.slice(0, 3), top8: known.fallback.top, allMarks: known.fallback.top,
    source: known.fallback.source, matchedMeetName: name,
    diagnostics: [...fetched.diagnostics, { source: 'known-competition-fallback' }]
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
// "Full coverage of the shorter name" is too weak on its own when that shorter name is itself
// mostly generic words - live-tested and confirmed: "German U23 Combined Events Championships"
// matched plain "German Championships" (score 1) because "german"+"championships" is a trivial
// subset of the wanted name's tokens, even though "u23"/"combined"/"events" are exactly the
// words that make it a different competition. Two guards close this: an age/category word
// present on only one side is a hard block (these mark genuinely different competitions, not
// wording differences), and the two names' meaningful-token counts can't differ by more than 2
// (an abbreviation swaps one word for one token, it doesn't add three qualifying words).
const CATEGORY_WORDS = new Set(['u23', 'u20', 'u18', 'u17', 'u16', 'u15', 'u14', 'junior', 'juniors', 'jr', 'youth', 'cadet', 'cadets']);
function categoryMismatch(a, b) {
  const as = new Set(a), bs = new Set(b);
  for (const w of CATEGORY_WORDS) if (as.has(w) !== bs.has(w)) return true;
  return false;
}
function nameScore(wanted, candidate) {
  if (!wanted || !candidate) return 0;
  if (wanted === candidate) return 4;
  if (candidate.includes(wanted) || wanted.includes(candidate)) return 3;
  const a = meaningfulTokens(wanted), b = meaningfulTokens(candidate);
  if (Math.abs(a.length - b.length) > 2) return 0;
  if (categoryMismatch(a, b)) return 0;
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
