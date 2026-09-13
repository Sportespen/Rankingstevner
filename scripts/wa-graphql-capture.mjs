// One-off diagnostic tool - NOT part of the daily key-refresh pipeline (see wa-key-refresh.mjs).
// getSingleCompetitor (the query nimarion's own client used) has no world-rankings field on this
// schema, and the getCISSingleCompetitor query that DOES have one is rejected as "Not Authorized"
// for the public x-api-key we capture. That means the real worldathletics.org athlete page must
// be fetching its "current world ranking" chip through some other GraphQL operation entirely.
// This script visits a real athlete page in a real browser and logs every single GraphQL request
// it makes (not just the first, like wa-key-refresh.mjs), so we can read the operation name and
// variables straight out of the Actions log and copy the real query.
import { chromium } from 'playwright';

const ATHLETE_URL = process.env.ATHLETE_URL || 'https://worldathletics.org/athletes/-/14989292';
const WAIT_AFTER_LOAD_MS = 6000;

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const seen = new Set();
    page.on('request', (req) => {
      const headers = req.headers();
      if (!headers['x-api-key']) return;
      const body = req.postData() || '';
      let operationName = '';
      let variables = null;
      try {
        const parsed = JSON.parse(body);
        operationName = parsed.operationName || '';
        variables = parsed.variables || null;
      } catch (_) {}
      const dedupeKey = operationName || body.slice(0, 80);
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      console.log('GraphQL op:', operationName || '(none)', 'vars:', JSON.stringify(variables));
    });
    await page.goto(ATHLETE_URL, { waitUntil: 'load', timeout: 30000 }).catch((e) => {
      console.error('goto failed (continuing to wait for late requests anyway):', e.message);
    });
    await page.waitForTimeout(WAIT_AFTER_LOAD_MS);
    console.log(`Done - captured ${seen.size} distinct GraphQL operation(s) from ${ATHLETE_URL}`);

    // None of the client-side GraphQL calls above carry world-ranking data - it may be baked
    // straight into the server-rendered HTML instead (a Next.js __NEXT_DATA__/self.__next_f
    // payload), which would need no API key or authorization at all to read. Check for that.
    const html = await page.content();
    console.log('\n=== Scanning rendered HTML for ranking data ===');
    console.log('Page length:', html.length);
    const idx = html.toLowerCase().indexOf('worldranking');
    if (idx === -1) {
      console.log('No occurrence of "worldRanking" found in the rendered HTML.');
    } else {
      // Confirmed: this lives in <script id="__NEXT_DATA__" type="application/json"> - plain,
      // unescaped JSON (Next.js Pages Router), fetchable with zero auth since the page is public.
      const openTagEnd = html.indexOf('>', html.indexOf('id="__NEXT_DATA__"')) + 1;
      const closeTag = html.indexOf('</script>', openTagEnd);
      const nextData = JSON.parse(html.slice(openTagEnd, closeTag));
      const pageProps = nextData?.props?.pageProps || {};
      console.log('pageProps top-level keys:', Object.keys(pageProps));
      const competitor = pageProps.competitor;
      if (competitor) {
        console.log('competitor top-level keys:', Object.keys(competitor));
        console.log('competitor.basicData:', JSON.stringify(competitor.basicData));
      }

      // Find every path to a "worldRankings" key anywhere in pageProps, in case it isn't nested
      // under `competitor` at all.
      function findPaths(obj, path, matches) {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          const p = path ? `${path}.${k}` : k;
          if (k === 'worldRankings') matches.push(p);
          findPaths(v, p, matches);
        }
      }
      const matches = [];
      findPaths(pageProps, 'pageProps', matches);
      console.log('Paths to "worldRankings":', matches);
      for (const p of matches) {
        const value = p.split('.').slice(1).reduce((o, k) => o?.[k], pageProps);
        console.log(`Value at ${p}:`, JSON.stringify(value));
      }

      // wa-results.js still depends entirely on nimarion.de for per-year results - check whether
      // this same public page also carries enough of that data (resultsByYear/seasonsBests) to
      // make it independent too, and whether a URL query param selects a different year.
      console.log('\n=== resultsByYear / seasonsBests on the default page ===');
      console.log('competitor.resultsByYear:', JSON.stringify(competitor.resultsByYear));
      console.log('competitor.seasonsBests:', JSON.stringify(competitor.seasonsBests));
      console.log('competitor.personalBests:', JSON.stringify(competitor.personalBests));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
