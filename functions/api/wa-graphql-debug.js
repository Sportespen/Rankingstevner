// Temporary - not linked from any UI. Used once to discover the real field names on
// CISbasicDataType after getSingleCompetitor's schema turned out to differ from what was
// documented in nimarion's own open-source client. Delete once wa-rank.js's query is fixed.
import { waGraphQL } from '../_shared/wa-graphql.js';

const QUERY = `query IntrospectType($name: String!) {
  __type(name: $name) {
    name
    kind
    fields {
      name
      args { name type { name kind ofType { name kind } } }
      type { name kind ofType { name kind ofType { name kind } } }
    }
    inputFields {
      name
      type { name kind ofType { name kind ofType { name kind } } }
    }
    enumValues { name }
  }
}`;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const name = (url.searchParams.get('type') || 'CISbasicDataType').trim();
  const filter = (url.searchParams.get('filter') || '').trim().toLowerCase();
  try {
    const data = await waGraphQL(context.env, QUERY, { name });
    let t = data?.__type;
    if (t && filter) {
      if (Array.isArray(t.fields)) t = { ...t, fields: t.fields.filter(f => f.name.toLowerCase().includes(filter)) };
      if (Array.isArray(t.inputFields)) t = { ...t, inputFields: t.inputFields.filter(f => f.name.toLowerCase().includes(filter)) };
    }
    return json({ ok: true, type: t });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) });
  }
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
