const LOCAL_ATHLETES = [
  {id:14989292,firstName:'Jonathan',lastName:'Hertwig-Ødegaard',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']},
  {id:14834505,firstName:'Sander',lastName:'Skotheim',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']}
];

let graphConfig = null;
let graphConfigAt = 0;
const GRAPH_CONFIG_TTL = 10 * 60 * 1000;

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
    const primaryQuery = parts.length > 1 && parts[0].length >= 2 ? parts[0] : q;
    const primary = await searchWaFast(primaryQuery);
    mergeAthletes(merged,primary,qNorm,qTokens);

    let ranked = rankedResults(merged);
    if (ranked.length) return json({ok:true,results:ranked,source:'wa-prefix-first'});

    if (normalize(primaryQuery) !== qNorm) {
      const exact = await searchWaFast(q);
      mergeAthletes(merged,exact,qNorm,qTokens);
      ranked = rankedResults(merged);
    }

    return json({ok:true,results:ranked,source:'wa-prefix-fallback'});
  } catch (e) {
    return json({ok:true,results:rankedResults(merged),source:'fallback',warning:String(e?.message||e)});
  }
}

async function searchWaFast(name) {
  const nonEmpty = p => p.then(list => {
    if (!Array.isArray(list) || !list.length) throw new Error('Tomt WA-svar');
    return list;
  });

  const attempts = [
    nonEmpty(searchWaGraphql(name, 1700)),
    nonEmpty(searchWaProxy(name, name.trim().includes(' ') ? 1500 : 2600))
  ];

  try {
    return await Promise.any(attempts);
  } catch (_) {
    return [];
  }
}

async function getGraphConfig() {
  if (graphConfig && Date.now() - graphConfigAt < GRAPH_CONFIG_TTL) return graphConfig;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1400);
  try {
    const [endpointRes,keyRes] = await Promise.all([
      fetch('https://worldathletics.nimarion.de/graphql/endpoint',{signal:controller.signal,headers:{'Accept':'application/json'}}),
      fetch('https://worldathletics.nimarion.de/graphql/api-key',{signal:controller.signal,headers:{'Accept':'application/json'}})
    ]);
    if (!endpointRes.ok || !keyRes.ok) throw new Error('Kunne ikke hente WA GraphQL-konfigurasjon');
    const endpointData = await endpointRes.json();
    const keyData = await keyRes.json();
    const endpoint = endpointData?.endpoint || endpointData?.url || endpointData?.value || endpointData?.apiEndpoint;
    const apiKey = keyData?.apiKey || keyData?.key || keyData?.value || keyData?.token;
    if (!endpoint || !apiKey) throw new Error('Ugyldig WA GraphQL-konfigurasjon');
    graphConfig = {endpoint,apiKey};
    graphConfigAt = Date.now();
    return graphConfig;
  } finally { clearTimeout(timeout); }
}

async function searchWaGraphql(name, timeoutMs=1700) {
  const cfg = await getGraphConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.endpoint, {
      method:'POST',
      signal:controller.signal,
      headers:{
        'content-type':'application/json',
        'accept':'application/json',
        'x-api-key':cfg.apiKey
      },
      body:JSON.stringify({
        query:'query searchCompetitors($name: String) { searchCompetitors(query: $name) { aaAthleteId familyName givenName birthDate disciplines gender country } }',
        variables:{name}
      })
    });
    if (!res.ok) throw new Error(`WA GraphQL feilet (${res.status})`);
    const data = await res.json();
    const list = data?.data?.searchCompetitors;
    if (!Array.isArray(list)) throw new Error('WA GraphQL ga ikke søkeliste');
    return list;
  } finally { clearTimeout(timeout); }
}

async function searchWaProxy(name, timeoutMs=1800) {
  const endpoint = `https://worldathletics.nimarion.de/athletes/search?name=${encodeURIComponent(name)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.18.1','Accept':'application/json'}
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Navnesøk mot World Athletics feilet (${res.status})`);
    return data;
  } finally { clearTimeout(timeout); }
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
