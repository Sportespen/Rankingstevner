// Reads an athlete's basic data and current world rankings straight out of the plain,
// server-rendered HTML of their public World Athletics profile page. Confirmed live via a
// one-off Playwright capture (scripts/wa-graphql-capture.mjs) that this exact data
// (pageProps.competitor.basicData / .worldRankings) is embedded as plain, unescaped JSON in a
// <script id="__NEXT_DATA__" type="application/json"> tag. Unlike the GraphQL backend, this needs
// no API key, no daily rotation and no authorization at all - the profile page is fully public,
// so this is the more robust of the two direct-access paths, not just a fallback.
export async function fetchCompetitorFromHtml(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  let res;
  try {
    res = await fetch(`https://worldathletics.org/athletes/-/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Rankingstevner/1.0' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`worldathletics.org svarte ${res.status}`);
  const html = await res.text();

  const marker = 'id="__NEXT_DATA__"';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) throw new Error('Fant ikke __NEXT_DATA__ i siden');
  const openTagEnd = html.indexOf('>', markerIdx) + 1;
  const closeTag = html.indexOf('</script>', openTagEnd);

  let nextData;
  try {
    nextData = JSON.parse(html.slice(openTagEnd, closeTag));
  } catch (e) {
    throw new Error('Kunne ikke tolke __NEXT_DATA__: ' + e.message);
  }

  const competitor = nextData?.props?.pageProps?.competitor;
  if (!competitor) throw new Error('Fant ingen utøverdata i siden');
  return competitor;
}
