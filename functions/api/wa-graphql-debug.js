// Temporary - not linked from any UI. Debugging why the placing-correction pass for Jonathan's
// Dinamo Zrinjevac 400m didn't land on the place (7th) the user says is correct. Dumps the raw
// getCalendarCompetitionResults field for a competition so the real heat/race structure can be
// inspected. Delete once done.
import { waGraphQL } from '../_shared/wa-graphql.js';

const QUERY = `query GetCalendarCompetitionResults($competitionId: Int) {
  getCalendarCompetitionResults(competitionId: $competitionId) {
    eventTitles {
      eventTitle
      events {
        event
        races {
          race
          raceNumber
          date
          results { place mark wind records competitor { id iaafId name } }
        }
        summary { placeInRace placeInRound points mark competitor { id iaafId name } }
      }
    }
  }
}`;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const competitionId = Number((url.searchParams.get('competitionId') || '').trim());
  const filter = (url.searchParams.get('event') || '').trim().toLowerCase();
  try {
    const data = await waGraphQL(context.env, QUERY, { competitionId });
    let eventTitles = data?.getCalendarCompetitionResults?.eventTitles || [];
    if (filter) {
      eventTitles = eventTitles.map(t => ({
        ...t,
        events: (t.events || []).filter(e => String(e.event || '').toLowerCase().includes(filter))
      })).filter(t => t.events.length);
    }
    return json({ ok: true, eventTitles });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) });
  }
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
