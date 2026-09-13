// Temporary - not linked from any UI. One-off test: is GetSingleCompetitorResultsDiscipline
// (confirmed to be called by the real, public worldathletics.org frontend without any auth
// problem) actually accessible with our own captured x-api-key for an arbitrary year? If so,
// wa-results.js can use this instead of scraping HTML for multi-year results. Delete once done.
import { waGraphQL } from '../_shared/wa-graphql.js';

const QUERY = `query GetSingleCompetitorResultsDiscipline($id: Int, $resultsByYearOrderBy: String, $resultsByYear: Int) {
  getSingleCompetitorResultsDiscipline(id: $id, resultsByYear: $resultsByYear, resultsByYearOrderBy: $resultsByYearOrderBy) {
    parameters { resultsByYear resultsByYearOrderBy }
    activeYears
    resultsByEvent {
      discipline
      results { date competition place mark wind notLegal resultScore category competitionId eventId }
    }
  }
}`;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = Number((url.searchParams.get('id') || '14989292').trim());
  const year = Number((url.searchParams.get('year') || '2024').trim());
  try {
    const data = await waGraphQL(context.env, QUERY, { id, resultsByYear: year, resultsByYearOrderBy: 'discipline' });
    return json({ ok: true, data });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) });
  }
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
