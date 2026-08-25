const LOCAL_ATHLETES = [
  {id:14989292,firstName:'Jonathan',lastName:'Hertwig-Ødegaard',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']},
  {id:14834505,firstName:'Sander',lastName:'Skotheim',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']}
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 1) return json({ok:true,results:[]});

  const qNorm = normalize(q);
  const parts = q.split(/\s+/).filter(Boolean);
  const qTokens = parts.map(normalize).filter(Boolean);
  const merged = new Map();

  // Lokale/cachede kjente utøvere er kun et tillegg. Hovedlogikken under er generell
  // og skal fungere for alle WA-navn uten at de må hardkodes her.
  for (const a of LOCAL_ATHLETES) {
    const score = matchScore(a,qNorm,qTokens);
    if (score > 0) merged.set(String(a.id), {...a,_score:score});
  }

  try {
    // Generell delnavn-logikk:
    //  - alltid søk på teksten brukeren faktisk har skrevet
    //  - ved flere ord søkes også fornavnet parallelt
    // Dette gjør f.eks. "Miranda L" mulig uten å vente på hele etternavnet.
    const queries = [q];
    if (parts.length > 1) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      if (first.length >= 2) queries.push(first);
      // Et brukbart etternavnsprefiks er nyttig ved søk som "Ola Nor".
      if (last.length >= 2) queries.push(last);
    }

    const uniqueQueries = [...new Set(queries.map(s=>s.trim()).filter(Boolean))].slice(0,3);
    const settled = await Promise.allSettled(uniqueQueries.map(name=>searchWa(name, 900)));
    for (const response of settled) {
      if (response.status === 'fulfilled') mergeAthletes(merged,response.value,qNorm,qTokens);
    }

    return json({ok:true,results:rankedResults(merged),source:'generic-partial'});
  } catch (e) {
    return json({ok:true,results:rankedResults(merged),source:'fallback',warning:String(e?.message||e)});
  }
}

function mergeAthletes(merged, raws, qNorm, qTokens) {
  for (const raw of raws || []) {
    const a = mapAthlete(raw);
    if (!a) continue;
    const score = matchScore(a,qNorm,qTokens);
    if (score <= 0) continue;
    const key = String(a.id);
    const existing = merged.get(key);
    if (!existing || score > existing._score) merged.set(key,{...a,_score:score});
  }
}

function rankedResults(merged) {
  return [...merged.values()]
    .sort((a,b) => b._score - a._score || displayName(a).localeCompare(displayName(b),'no'))
    .slice(0,20)
    .map(({_score,...a}) => a);
}

async function searchWa(name, timeoutMs=900) {
  const endpoint = `https://worldathletics.nimarion.de/athletes/search?name=${encodeURIComponent(name)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.17.1','Accept':'application/json'}
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

function tokenMatches(nameToken, queryToken) {
  if (!nameToken || !queryToken) return false;
  return nameToken.startsWith(queryToken) || nameToken.includes(queryToken);
}

function matchScore(a,qNorm,qTokens) {
  const full = normalize(displayName(a));
  const first = normalize(a.firstName);
  const last = normalize(a.lastName);
  const nameTokens = full.split(' ').filter(Boolean);
  if (!full) return 0;

  let score = 0;
  if (full === qNorm) score += 12000;
  if (full.startsWith(qNorm)) score += 9500;
  else if (full.includes(qNorm)) score += 5000;

  // Alle skrevne ord må passe som prefiks/delstreng mot minst ett navn-token.
  // Dermed rangeres "Miranda L" høyt mot "Miranda Lauvstad" selv om etternavnet er uferdig.
  for (let i=0;i<qTokens.length;i++) {
    const token=qTokens[i];
    if (!token) continue;
    const matched = nameTokens.some(n=>tokenMatches(n,token));
    if (!matched) return 0;
    score += i===0 ? 2200 : 3200;
  }

  if (qTokens.length > 1) {
    const firstQ=qTokens[0], lastQ=qTokens[qTokens.length-1];
    if (first.startsWith(firstQ)) score += 3500;
    if (last.startsWith(lastQ)) score += 6500 + Math.min(lastQ.length,8)*250;
  } else if (qTokens.length===1) {
    const t=qTokens[0];
    if (first.startsWith(t)) score += 3000;
    if (last.startsWith(t)) score += 2800;
  }

  return score;
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    }
  });
}
