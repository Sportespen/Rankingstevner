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
      console.log('=== GraphQL request ===');
      console.log('operationName:', operationName || '(none)');
      console.log('variables:', JSON.stringify(variables));
      console.log('query:', body.slice(0, 4000));
      console.log('');
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
      // Find which <script> tag this JSON blob lives inside, so we know exactly how to extract
      // and parse it server-side later (id, type, whether it needs JS-string unescaping like a
      // Next.js App Router self.__next_f.push(...) chunk, or is raw JSON like a
      // <script id="__NEXT_DATA__" type="application/json"> Pages Router blob).
      const scriptStart = html.lastIndexOf('<script', idx);
      const tagEnd = html.indexOf('>', scriptStart);
      const scriptOpenTag = html.slice(scriptStart, tagEnd + 1);
      const scriptClose = html.indexOf('</script>', idx);
      console.log('Enclosing <script> open tag:', scriptOpenTag);
      console.log('Enclosing script length:', scriptClose - tagEnd - 1);
      console.log('First 300 chars of that script:', html.slice(tagEnd + 1, tagEnd + 301));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
