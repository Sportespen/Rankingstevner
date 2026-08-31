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
// Universal event metadata: which codes are supported beyond Decathlon/Heptathlon, WA's own
// English discipline name for each (needed to find the right block in a day-page's data - see
// waDisciplineFullName below), and sort direction (track events: lower mark wins; everything
// else, including combined events: higher wins). Norwegian display labels for these same codes
// already exist in app.js's eventDefinitions - this is WA's OWN naming instead, confirmed
// directly from live diagnostics ("Men's 100 Metres", "Men's Long Jump", etc., see
// fetchStandingsForCompetition's day-based fallback).
const TRACK_EVENTS = new Set(['100m', '200m', '400m', '800m', '1500m', '5000m', '10000m', '100mH', '110mH', '400mH', '3000mSC']);
const WA_DISCIPLINE_NAME = {
  '100m': '100 Metres', '200m': '200 Metres', '400m': '400 Metres', '800m': '800 Metres',
  '1500m': '1500 Metres', '5000m': '5000 Metres', '10000m': '10000 Metres',
  '100mH': '100 Metres Hurdles', '110mH': '110 Metres Hurdles', '400mH': '400 Metres Hurdles',
  '3000mSC': '3000 Metres Steeplechase',
  HJ: 'High Jump', PV: 'Pole Vault', LJ: 'Long Jump', TJ: 'Triple Jump',
  SP: 'Shot Put', DT: 'Discus Throw', HT: 'Hammer Throw', JT: 'Javelin Throw',
};
// Indoor tracks are too short to run some outdoor sprints/hurdles at their nominal distance - WA
// substitutes a genuinely different, shorter distance instead. Confirmed live: an indoor meet's
// day page listed "Men's 60 Metres" with no "100 Metres" block at all. A 60m time isn't
// comparable to a 100m time, so a match found this way is shown as reference only - no placement
// claim against the athlete's own mark (see meet-history.js's `comparable` handling).
const INDOOR_SPRINT_ALT_NAME = {
  '100m': '60 Metres',
  '100mH': '60 Metres Hurdles',
  '110mH': '60 Metres Hurdles',
};
// Machine-readable version of the same substitution, in this app's own event-code convention -
// lets the frontend look up the athlete's OWN best mark for the substitute distance (e.g. their
// own 60m PB from other indoor meets) instead of only ever showing the substitute results as an
// unattributed reference. See meet-history.js's `matchedEventCode` handling.
const INDOOR_SPRINT_ALT_CODE = { '100m': '60m', '100mH': '60mH', '110mH': '60mH' };
// These stay the SAME nominal distance indoors - WA just appends "Short Track" to note the
// venue, not a shorter race (confirmed live on the same indoor day page: "Men's 400 Metres Short
// Track", "...800 Metres Short Track", "...1500 Metres Short Track") - so a mark found this way
// IS directly comparable to the athlete's own outdoor mark for the same event.
const SHORT_TRACK_SUFFIX_EVENTS = new Set(['400m', '800m', '1500m']);
// Ordered list of {name, comparable} to try against a single day page's own event blocks - same
// distance first (comparable), then any indoor substitute WA uses for that discipline (not
// comparable, reference only). No extra fetch needed: a day page already lists every discipline
// held that day, so trying more names costs nothing beyond a second in-memory scan of the same
// already-fetched HTML.
function individualEventNameCandidates(event, gender) {
  const primary = waDisciplineFullName(event, gender);
  const out = [];
  if (primary) out.push({ name: primary, comparable: true });
  if (primary && SHORT_TRACK_SUFFIX_EVENTS.has(event)) out.push({ name: `${primary} Short Track`, comparable: true });
  const alt = INDOOR_SPRINT_ALT_NAME[event];
  if (alt) out.push({ name: `${gender === 'W' ? "Women's" : "Men's"} ${alt}`, comparable: false, code: INDOOR_SPRINT_ALT_CODE[event] });
  return out;
}
// None of the fetches in this file had a per-request deadline - a single lookup can chain up to
// ~15 calendar-page fetches (3 years back x offset pages) plus another ~9 results-page fetches
// (eventId/day candidates), and meet-search.js already showed live what happens when that many
// sequential/untimed external calls run too long: Cloudflare kills the whole request and returns
// its own HTML error page instead of a real response. Same fix here.
const FETCH_TIMEOUT_MS = 8000;
// Results pages are real, server-rendered Next.js pages (~85KB seen live) rather than the
// calendar list's lighter pages, and now fetch concurrently (up to 4 day candidates at once) -
// live diagnostics showed a real, data-bearing day page aborted at 8s ("The operation was
// aborted") while the empty 500-error days next to it returned fast, meaning the slower real
// page needs more headroom, not a shorter deadline. Only used for the results-page fetches
// (which already run in parallel via Promise.all, so this doesn't multiply worst-case wall time
// the way raising it for the sequential window-search loop above would).
const RESULTS_FETCH_TIMEOUT_MS = 15000;
async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
function isCombinedEvent(event) { return event === 'Decathlon' || event === 'Heptathlon'; }
function isSupportedEvent(event) { return isCombinedEvent(event) || !!WA_DISCIPLINE_NAME[event]; }
function isAscending(event) { return TRACK_EVENTS.has(event); }
function waDisciplineFullName(event, sex) {
  const base = WA_DISCIPLINE_NAME[event];
  return base ? `${sex === 'W' ? "Women's" : "Men's"} ${base}` : null;
}
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
  // Competition id 7229280 ("German U23 Championships") was wrong - live diagnostics showed
  // it's a completely different, general U23 track meet with no combined events at all (its
  // event list across all 3 days never included Decathlon/Heptathlon). The senior "Deutsche
  // Mehrkampf-Meisterschaften" in Hannover (competitionId 7229381, confirmed correct via its own
  // WA results link) runs all age categories together in one meet ("DM Mehrkampf
  // M/W/U23/U20/U18/U16", per the German federation's own announcement) - so U23 almost
  // certainly lives in that SAME competition, under a different eventId/day than the senior
  // heat, not a separate competition id.
  // excludeWinnerMark guards against the exact bug this whole investigation started from: since
  // eventId=10229629 on this same competitionId is confirmed to return the SENIOR heat's data
  // (Tim Nowak, 8140), trying that same candidate here would return identical results silently
  // mislabelled as U23 - rejecting a fetch that comes back with the known senior mark, treating
  // it as not-found instead, is worse-case-safe until the actual U23-specific eventId is known.
  { match: /german.*u23.*combined events championships/i, event: 'Decathlon', competitionId: 7229381, year: 2025, excludeWinnerMark: 8140 },
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
  // Only meaningful for individual events - Decathlon/Heptathlon already encode sex in the code
  // itself (this app's own convention: men=Decathlon, women=Heptathlon, regardless of season).
  // An individual event code like "LJ" doesn't, so the frontend sends the athlete's actual sex.
  const sex = (url.searchParams.get('sex') || 'M').trim().toUpperCase() === 'W' ? 'W' : 'M';
  const refDateRaw = (url.searchParams.get('date') || '').trim();
  if (!name) return json({ ok: false, error: 'Mangler stevnenavn' }, 400);
  if (!isSupportedEvent(event)) return json({ ok: true, found: false, reason: 'unsupported-event' });

  // VERIFIED and KNOWN_COMPETITION only ever list Decathlon/Heptathlon entries (all hand-
  // researched or ID-confirmed so far), so individual events always fall through to the live
  // calendar-search path below - correct for now, revisit once an individual-event meet is
  // worth hand-verifying the same way.
  const verified = isCombinedEvent(event) && VERIFIED.find(v => v.event === event && v.match.test(name));
  if (verified) {
    return json({
      ok: true, found: true, year: verified.year, winner: verified.winner, winnerMark: verified.winnerMark,
      top3: verified.top.slice(0, 3), top8: verified.top, allMarks: verified.top,
      ascending: false, source: verified.source, matchedMeetName: name,
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
  // Started once, before the loop, and NOT awaited yet - live diagnostics showed a single lookup
  // taking ~25s total, and this fetch being awaited before the calendar search even started (so
  // its own latency stacked serially on top of the calendar search's) was a large, needless part
  // of that: nimarion's /competitions feed is a live/upcoming-meets feed (~50 entries, confirmed
  // live) that essentially never contains a match for a PAST year's edition, which is exactly
  // what this search is centered on. It's only ever kept as a supplementary source, so it now
  // runs concurrently with the first round of calendar-page fetches instead of blocking them -
  // whichever is slower gates this stage, not the sum of both.
  const nimarionPromise = (async () => {
    try {
      const r = await fetchWithTimeout('https://worldathletics.nimarion.de/competitions', { headers: { Accept: 'application/json', 'User-Agent': 'Rankingstevner/1.0' } });
      return r.ok ? await r.json() : null;
    } catch (e) {
      diagnostics.push({ source: 'nimarion-competitions', error: String(e?.message || e) });
      return null;
    }
  })();
  let nimarionLogged = false;

  // Small domestic/regional championships often don't run on a fixed weekend from year to
  // year (unlike GL Tour meets), so a ±30 day window missed some real editions. Widened to
  // ±45 days, and a 3rd yearsBack pass added for meets on a longer or irregular cycle.
  for (const yearsBack of [1, 2, 3]) {
    const center = new Date(refDate.getTime() - yearsBack * 365 * 24 * 3600 * 1000);
    const windowStart = new Date(center.getTime() - 45 * 24 * 3600 * 1000);
    const windowEnd = new Date(center.getTime() + 45 * 24 * 3600 * 1000);
    const seen = new Set();
    const windowCandidates = [];

    // Fired immediately, awaited last - overlaps with the nimarion fetch below instead of
    // stacking after it.
    const calendarPromise = Promise.all([0, 100, 200, 300, 400].map(async offset => {
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
      // Previously restricted to disciplineId=1 ("Combined Events") for Decathlon/Heptathlon
      // searches. Removed after live diagnostics for a real meet ("Låvefesten") showed 0 matches
      // across 300 "Combined Events"-filtered candidates over 3 years, despite it being a
      // genuinely recurring meet - WA's own Discipline category is too coarse to filter on (the
      // same coarseness meet-search.js already had to work around): a club meet that hosts a
      // combined event alongside ordinary track and field is commonly tagged just "Track and
      // Field", not "Combined Events". Individual events already searched unfiltered by
      // discipline for the same reason; combined events now do too - safe to widen, since the
      // eventNameFullName-based results extraction below only ever accepts standings whose own
      // "event" field actually matches the wanted discipline, so extra candidates just fall
      // through to "no-standings-found" rather than causing a wrong match.
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
        const r = await fetchWithTimeout(wa.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } });
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

    const nimarionAll = await nimarionPromise;
    if (!nimarionLogged) { diagnostics.push({ source: 'nimarion-competitions', count: Array.isArray(nimarionAll) ? nimarionAll.length : 0 }); nimarionLogged = true; }
    for (const x of Array.isArray(nimarionAll) ? nimarionAll : []) {
      if (!x?.id || !x?.name || !x?.start) continue;
      const d = parseDate(x.start);
      if (!d || d < windowStart || d > windowEnd) continue;
      const key = `${x.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      windowCandidates.push({ id: x.id, name: x.name, start: x.start });
    }

    await calendarPromise;

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
  const fetched = await fetchStandingsForCompetition(best.id, event, sex);
  diagnostics.push(...fetched.diagnostics);
  if (!fetched.rows.length) return json({ ok: true, found: false, reason: 'no-standings-found', diagnostics });

  // fetchStandingsForCompetition already returns rows sorted best-first (it knows internally
  // whether this event's "better" is a higher or lower mark), so rows[0] is always the winner
  // regardless of event type - no re-sort needed here.
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
    ascending: isAscending(event),
    competitionId: best.id,
    eventId: fetched.eventId,
    source: fetched.resultsUrl,
    matchedMeetName: best.name,
    comparable: fetched.comparable !== false,
    matchedEventName: fetched.matchedEventName || null,
    matchedEventCode: fetched.matchedEventCode || null,
    diagnostics
  });
}

// Tries each candidate eventId in turn against a competition's WA results page, returning the
// first one whose page actually has standings for the wanted event - combined or individual.
// Shared by the calendar-search path above and the known-competition-ID path below. Always
// returns rows already sorted best-first (winner at index 0), since the two event families sort
// in opposite directions (combined/field events: higher wins; track events: lower wins) - the
// caller shouldn't have to know which.
// Each eventId/day candidate used to be tried one after another with no timeout - a meet that
// fell through every tier (unconfirmed eventIds, all 4 days) could chain up to 9 sequential
// untimed external fetches for a single lookup. Now fetched concurrently per tier and time-
// bounded (fetchWithTimeout), then picked in the same priority order as before (first candidate
// in the original list that actually has standings wins) - purely a wall-clock/reliability fix,
// same winner as the old sequential version would have picked.
async function fetchStandingsForCompetition(competitionId, event, sex) {
  // Confirmed via a user-provided worldathletics.org link
  // (results/7230385?eventId=10229571&gender=M) that WA's own URL structure includes an
  // explicit gender param alongside eventId. Decathlon/Heptathlon already encode sex in the code
  // itself (this app's convention: men=Decathlon, women=Heptathlon); an individual event code
  // doesn't, so `sex` (from the athlete's own profile/selection) is used there instead.
  const gender = isCombinedEvent(event) ? (event === 'Decathlon' ? 'M' : 'W') : sex;
  const diagnostics = [];

  if (isCombinedEvent(event)) {
    const eventIds = EVENT_ID_CANDIDATES[event] || [];
    // All candidates start fetching immediately (.map already launches each fetch, not lazily) -
    // this keeps the network-overlap benefit of running them concurrently. But awaiting them IN
    // PRIORITY ORDER, one at a time, means a fast-but-wrong later candidate can never make the
    // response wait for a slow-but-irrelevant one behind it once the real (earlier-priority) one
    // has already answered - unlike Promise.all, which always waits for every candidate
    // (including ones whose answer nobody needed) before the caller can see any result.
    const attemptPromises = eventIds.map(eventId => fetchCombinedEventCandidate(competitionId, eventId, gender));
    for (let i = 0; i < attemptPromises.length; i++) {
      const attempt = await attemptPromises[i];
      diagnostics.push(...attempt.diagnostics);
      if (attempt.rows.length) {
        const rows = attempt.rows.slice().sort((a, b) => b.mark - a.mark);
        return { rows, eventId: eventIds[i], resultsUrl: attempt.resultsUrl, diagnostics };
      }
    }
  }

  // Day-based: for a general multi-day national championships holding combined events (German
  // U23, North Macedonian - both confirmed via live diagnostics), the eventId candidates above
  // don't apply - those competitions file every discipline under their own competition-specific
  // eventIds, not the global ones (a 10229629 request there came back HTTP 500 - not registered
  // for that competition at all). For individual events this is the ONLY strategy tried: there's
  // no confirmed global eventId for any of them, so this goes straight to asking for a whole
  // day's data (the same ?day=N shape this app's own original German Championships research URL
  // used) and picks out the specific event by its WA name instead.
  const nameCandidates = isCombinedEvent(event) ? null : individualEventNameCandidates(event, gender);
  // Same pattern as the eventId candidates above: all 4 days start fetching at once (so a real
  // day-1 page and three quick day-2/3/4 "not held" errors overlap on the wire), but are awaited
  // in order - day 1's answer alone gates the response once it has rows, instead of the response
  // always waiting for whichever of the four takes longest (day 1's real ~85KB page has been
  // observed live to take meaningfully longer than an empty day's fast error response).
  const dayPromises = [1, 2, 3, 4].map(day => fetchDayCandidate(competitionId, day, gender, event, nameCandidates));
  for (let i = 0; i < dayPromises.length; i++) {
    const attempt = await dayPromises[i];
    diagnostics.push(...attempt.diagnostics);
    if (attempt.rows.length) {
      const rows = isCombinedEvent(event) ? attempt.rows.slice().sort((a, b) => b.mark - a.mark) : attempt.rows;
      return { rows, eventId: null, resultsUrl: attempt.resultsUrl, comparable: attempt.comparable !== false, matchedEventName: attempt.matchedEventName || null, matchedEventCode: attempt.matchedEventCode || null, diagnostics };
    }
  }
  return { rows: [], eventId: null, resultsUrl: null, diagnostics };
}
async function fetchCombinedEventCandidate(competitionId, eventId, gender) {
  const resultsUrl = new URL(`https://worldathletics.org/competition/calendar-results/results/${competitionId}`);
  resultsUrl.searchParams.set('eventId', String(eventId));
  resultsUrl.searchParams.set('gender', gender);
  let html = '', status = null;
  try {
    const r = await fetchWithTimeout(resultsUrl.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } }, RESULTS_FETCH_TIMEOUT_MS);
    status = r.status;
    if (r.ok) html = await r.text();
  } catch (e) {
    return { rows: [], resultsUrl: resultsUrl.toString(), diagnostics: [{ source: 'wa-results-page', url: resultsUrl.toString(), eventId, error: String(e?.message || e) }] };
  }
  const rows = extractCombinedEventStandings(html);
  const base = { source: 'wa-results-page', url: resultsUrl.toString(), eventId, status, htmlLength: html.length };
  if (rows.length) return { rows, resultsUrl: resultsUrl.toString(), diagnostics: [base] };
  // Temporary while this page's embedded data shape is unverified: show enough of the
  // __NEXT_DATA__ payload (or its absence) to see what's actually there.
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  return { rows: [], resultsUrl: resultsUrl.toString(), diagnostics: [base, {
    source: 'wa-results-shape', eventId, hasNextData: !!m,
    nextDataLength: m ? m[1].length : 0,
    nextDataSample: m ? decode(m[1]).slice(0, 800) : null,
    htmlSample: !m ? html.slice(0, 500) : null
  }] };
}
async function fetchDayCandidate(competitionId, day, gender, event, nameCandidates) {
  const resultsUrl = new URL(`https://worldathletics.org/competition/calendar-results/results/${competitionId}`);
  resultsUrl.searchParams.set('day', String(day));
  resultsUrl.searchParams.set('gender', gender);
  let html = '', status = null;
  try {
    const r = await fetchWithTimeout(resultsUrl.toString(), { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' } }, RESULTS_FETCH_TIMEOUT_MS);
    status = r.status;
    if (r.ok) html = await r.text();
  } catch (e) {
    return { rows: [], resultsUrl: resultsUrl.toString(), diagnostics: [{ source: 'wa-results-page-by-day', url: resultsUrl.toString(), day, error: String(e?.message || e) }] };
  }
  const base = { source: 'wa-results-page-by-day', url: resultsUrl.toString(), day, status, htmlLength: html.length };
  if (isCombinedEvent(event)) {
    const rows = extractCombinedEventStandings(html);
    if (rows.length) return { rows, resultsUrl: resultsUrl.toString(), comparable: true, diagnostics: [base] };
  } else if (Array.isArray(nameCandidates)) {
    // Same distance tried first, any indoor substitute (comparable:false) only as a fallback -
    // see individualEventNameCandidates. All against this same already-fetched HTML, no extra
    // network round trip per candidate.
    for (const candidate of nameCandidates) {
      const rows = extractIndividualEventStandings(html, candidate.name, isAscending(event));
      if (rows.length) return { rows, resultsUrl: resultsUrl.toString(), comparable: candidate.comparable, matchedEventName: candidate.name, matchedEventCode: candidate.code || null, diagnostics: [base] };
    }
  }
  // A day page can be huge (hundreds of KB, every discipline held that day) - dumping a raw
  // text sample like the eventId candidate does would be unreadable. Pulling out just the
  // distinct "event" name strings shows directly whether the wanted discipline is even on that
  // day at all, which is the actual question, without needing the full payload.
  const eventNames = [...new Set([...html.matchAll(/"event"\s*:\s*"([^"]+)"/g)].map(m => m[1]))];
  return { rows: [], resultsUrl: resultsUrl.toString(), diagnostics: [base, { source: 'wa-results-day-shape', day, wantedNames: nameCandidates?.map(c => c.name) || null, eventNamesFound: eventNames.slice(0, 40) }] };
}

// Fetches+parses the real results page directly for a meet whose WA competition ID is already
// known, bypassing the calendar-search/name-matching entirely - see KNOWN_COMPETITION's comment
// for why. Falls back to the hand-researched partial data if the live fetch/parse comes back
// empty, so this can only add depth, never regress below what was already confirmed. `fallback`
// is optional - some known-ID entries (a competition ID confirmed via search, but with no
// findable news coverage of its own) have nothing to fall back to, so "not found" if the live
// fetch fails there, same as if the ID had never been known at all.
async function resolveKnownCompetition(known, event, name) {
  const fetched = await fetchStandingsForCompetition(known.competitionId, event, null);
  if (fetched.rows.length && fetched.rows.some(r => r.mark === known.excludeWinnerMark)) {
    fetched.diagnostics.push({ source: 'known-competition-excluded', reason: 'matched another age category\'s known result', excludeWinnerMark: known.excludeWinnerMark });
    fetched.rows = [];
  }
  if (fetched.rows.length) {
    // Already sorted best-first by fetchStandingsForCompetition - no re-sort needed.
    const marks = fetched.rows.map(r => r.mark);
    const winner = fetched.rows[0];
    return json({
      ok: true, found: true, year: known.year, winner: winner.name || known.fallback?.winner || null, winnerMark: winner.mark,
      top3: marks.slice(0, 3), top8: marks.slice(0, 8), allMarks: marks, ascending: false,
      competitionId: known.competitionId, eventId: fetched.eventId, source: fetched.resultsUrl, matchedMeetName: name,
      comparable: fetched.comparable !== false, matchedEventName: fetched.matchedEventName || null, matchedEventCode: fetched.matchedEventCode || null,
      diagnostics: [...fetched.diagnostics, { source: 'known-competition-live' }]
    });
  }

  if (!known.fallback) return json({ ok: true, found: false, reason: 'known-competition-no-standings', diagnostics: fetched.diagnostics });

  return json({
    ok: true, found: true, year: known.year, winner: known.fallback.winner, winnerMark: known.fallback.winnerMark,
    top3: known.fallback.top.slice(0, 3), top8: known.fallback.top, allMarks: known.fallback.top, ascending: false,
    source: known.fallback.source, matchedMeetName: name, comparable: true,
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
// An individual-event day-page's __NEXT_DATA__ holds a separate block per discipline (confirmed
// via live diagnostics: {"event":"Men's 100 Metres","eventId":...,"races":[{"race":"Final",
// "results":[{"competitor":{"name":...},"mark":...}]}]}) - unlike combined events, this can't be
// found by a generic {place, mark-in-range} shape scan, since a raw time/distance could be any
// number. Instead this finds the ONE block whose "event" name matches what's wanted (e.g. "Men's
// Long Jump"), then reads its own results directly.
function extractIndividualEventStandings(html, wantedEventName, ascending) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  let data;
  try { data = JSON.parse(decode(m[1])); } catch (_) { return []; }
  const wantedNorm = wantedEventName.toLowerCase();
  const blocks = [];
  (function walk(v) {
    if (!v) return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v !== 'object') return;
    if (typeof v.event === 'string' && v.event.toLowerCase() === wantedNorm && Array.isArray(v.races)) blocks.push(v);
    for (const x of Object.values(v)) walk(x);
  })(data);
  if (!blocks.length) return [];

  const raw = [];
  for (const block of blocks) {
    // Prefer the race explicitly marked "Final"; a heat/qualifying round isn't the meet's actual
    // placing. Some events (a straight single-round race) may have only one race with no
    // "Final" label at all, hence the raceNumber fallback.
    const races = Array.isArray(block.races) ? block.races : [];
    const finalRace = races.find(r => /final/i.test(r?.race || '')) || races.slice().sort((a, b) => (b?.raceNumber || 0) - (a?.raceNumber || 0))[0];
    if (!finalRace || !Array.isArray(finalRace.results)) continue;
    for (const r of finalRace.results) {
      const mark = parseIndividualMark(r?.mark ?? r?.result ?? r?.performance);
      if (!Number.isFinite(mark) || mark <= 0) continue;
      const name = athleteDisplayName(r?.competitor) || athleteDisplayName(r?.athlete) || guessNameField(r || {});
      raw.push({ mark, name });
    }
  }
  if (!raw.length) return [];
  // Placement is derived from sorted order rather than trusting a possibly-inconsistent "place"
  // field in the source data (a DNF/DQ entry could otherwise skew a raw place number) - a mark
  // that didn't parse was already dropped above, so every remaining row is a genuine result.
  raw.sort((a, b) => ascending ? a.mark - b.mark : b.mark - a.mark);
  return raw.map((r, i) => ({ place: i + 1, mark: r.mark, name: r.name }));
}
// Individual-event marks come as raw strings - "10.32" (seconds), "7.85" (metres), or "1:45.20"
// / "3:32.10" (MM:SS.ss, or H:MM:SS.ss for very long track events) - not a fixed-format points
// total. Converts any of those to a single comparable number (seconds, or metres/points as-is).
function parseIndividualMark(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return NaN;
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.some(v => !Number.isFinite(v))) return NaN;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return NaN;
  }
  const n = Number(s.replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
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
