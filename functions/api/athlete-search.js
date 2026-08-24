export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ok:true,results:[]});

  try {
    const parts = q.split(/\s+/).filter(Boolean);
    const queries = [q];

    // WA-søket kan vekte fornavn for hardt. Ved flere navnedeler søker vi
    // derfor også separat på siste navnedel og rangerer alle treff lokalt.
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (last.length >= 2 && normalize(last) !== normalize(q)) queries.push(last);
    }

    const responses = await Promise.all(queries.map(searchWa));
    const merged = new Map();
    for (const list of responses) {
      for (const a of list) {
        const mapped = mapAthlete(a);
        if (mapped && !merged.has(mapped.id)) merged.set(mapped.id, mapped);
      }
    }

    const qNorm = normalize(q);
    const qTokens = parts.map(normalize).filter(Boolean);

    const results = [...merged.values()]
      .map(a => ({...a,_score:matchScore(a,qNorm,qTokens)}))
      .filter(a => a._score > 0)
      .sort((a,b) => b._score - a._score || displayName(a).localeCompare(displayName(b),'no'))
      .slice(0,12)
      .map(({_score,...a}) => a);

    return json({ok:true,results});
  } catch (e) {
    return json({ok:false,error:'Kunne ikke søke etter utøver',detail:String(e?.message || e)},502);
  }
}

async function searchWa(name) {
  const endpoint = `https://worldathletics.nimarion.de/athletes/search?name=${encodeURIComponent(name)}`;
  const res = await fetch(endpoint, {
    headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.8.3','Accept':'application/json'}
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  if (!res.ok || !Array.isArray(data)) throw new Error(`Navnesøk mot World Athletics feilet (${res.status})`);
  return data;
}

function mapAthlete(a) {
  const id = Number(a.id ?? a.aaAthleteId ?? a.athleteId);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    firstName: a.firstname ?? a.firstName ?? a.givenName ?? '',
    lastName: a.lastname ?? a.lastName ?? a.familyName ?? '',
    country: a.country ?? a.countryCode ?? '',
    sex: a.sex ?? a.gender ?? null,
    birthDate: a.birthDate ?? a.dateOfBirth ?? null,
    disciplines: Array.isArray(a.disciplines) ? a.disciplines : []
  };
}

function displayName(a) {
  return `${a.firstName || ''} ${a.lastName || ''}`.trim();
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/ø/g,'o')
    .replace(/æ/g,'ae')
    .replace(/å/g,'a')
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function matchScore(a,qNorm,qTokens) {
  const full = normalize(displayName(a));
  const first = normalize(a.firstName);
  const last = normalize(a.lastName);
  if (!full) return 0;

  let score = 0;
  if (full === qNorm) score += 10000;
  if (full.startsWith(qNorm)) score += 7000;
  else if (full.includes(qNorm)) score += 5000;

  let allTokens = true;
  for (const token of qTokens) {
    if (!token) continue;
    if (first.startsWith(token) || last.startsWith(token)) score += 900;
    else if (full.includes(token)) score += 500;
    else allTokens = false;
  }
  if (allTokens && qTokens.length > 1) score += 3000;

  // Etternavnet skal veie tungt når brukeren har begynt å skrive det.
  const lastQuery = qTokens[qTokens.length - 1];
  if (qTokens.length > 1 && lastQuery) {
    if (last.startsWith(lastQuery)) score += 2500;
    else if (last.includes(lastQuery)) score += 1200;
  }

  return score;
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
