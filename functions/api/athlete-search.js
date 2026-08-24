const LOCAL_ATHLETES = [
  {id:14989292,firstName:'Jonathan',lastName:'Hertwig-Ødegaard',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']}
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 1) return json({ok:true,results:[]});

  const qNorm = normalize(q);
  const parts = q.split(/\s+/).filter(Boolean);
  const qTokens = parts.map(normalize).filter(Boolean);

  const merged = new Map();
  for (const a of LOCAL_ATHLETES) {
    const score = matchScore(a,qNorm,qTokens);
    if (score > 0) merged.set(String(a.id), {...a,_score:score});
  }

  try {
    const queries = [q];
    if (parts.length > 1) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      queries.push(first);
      if (last.length >= 2) {
        queries.push(last);
        queries.push(`${last} ${first}`);
        queries.push(`${first} ${last}`);
      }
    }

    const uniqueQueries = [...new Set(queries.map(s=>s.trim()).filter(Boolean))];
    const settled = await Promise.allSettled(uniqueQueries.map(searchWa));
    for (const response of settled) {
      if (response.status !== 'fulfilled') continue;
      for (const raw of response.value) {
        const a = mapAthlete(raw);
        if (!a) continue;
        const score = matchScore(a,qNorm,qTokens);
        if (score <= 0) continue;
        const key = String(a.id);
        const existing = merged.get(key);
        if (!existing || score > existing._score) merged.set(key,{...a,_score:score});
      }
    }

    const results = [...merged.values()]
      .sort((a,b) => b._score - a._score || displayName(a).localeCompare(displayName(b),'no'))
      .slice(0,20)
      .map(({_score,...a}) => a);

    return json({ok:true,results,source:'merged'});
  } catch (e) {
    const results = [...merged.values()]
      .sort((a,b) => b._score - a._score || displayName(a).localeCompare(displayName(b),'no'))
      .slice(0,20)
      .map(({_score,...a}) => a);
    return json({ok:true,results,source:'local-fallback',warning:String(e?.message||e)});
  }
}

async function searchWa(name) {
  const endpoint = `https://worldathletics.nimarion.de/athletes/search?name=${encodeURIComponent(name)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.9.0','Accept':'application/json'}
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!res.ok || !Array.isArray(data)) throw new Error(`Navnesøk mot World Athletics feilet (${res.status})`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
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
  if (full.startsWith(qNorm)) score += 9000;
  else if (full.includes(qNorm)) score += 5000;

  let allTokens = true;
  for (const token of qTokens) {
    if (!token) continue;
    if (first.startsWith(token) || last.startsWith(token)) score += 1000;
    else if (full.includes(token)) score += 500;
    else allTokens = false;
  }
  if (allTokens && qTokens.length > 1) score += 4500;

  const lastQuery = qTokens[qTokens.length - 1];
  if (qTokens.length > 1 && lastQuery) {
    if (last.startsWith(lastQuery)) score += 7000 + Math.min(lastQuery.length, 8) * 300;
    else if (last.includes(lastQuery)) score += 1500;
    else return 0;
  }

  return score;
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
