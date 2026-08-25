const LOCAL_ATHLETES = [
  {id:14989292,firstName:'Jonathan',lastName:'Hertwig-Ødegaard',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']},
  {id:14834505,firstName:'Sander',lastName:'Skotheim',country:'NOR',sex:'M',birthDate:null,disciplines:['Decathlon']},
  {id:14829726,firstName:'Miranda',lastName:'Lauvstad',country:'NOR',sex:'W',birthDate:'2003-11-22',disciplines:['Long Jump','Heptathlon']}
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const sexFilter = String(url.searchParams.get('sex') || '').toUpperCase();
  if (q.length < 1) return json({ok:true,results:[]});

  const qNorm = normalize(q);
  const parts = q.split(/\s+/).filter(Boolean);
  const qTokens = parts.map(normalize).filter(Boolean);

  const merged = new Map();
  for (const a of LOCAL_ATHLETES) {
    if (sexFilter && a.sex && a.sex !== sexFilter) continue;
    const score = matchScore(a,qNorm,qTokens);
    if (score > 0) merged.set(String(a.id), {...a,_score:score});
  }

  // Sterke prefikstreff i den lokale hurtigindeksen returneres umiddelbart.
  // Dette gjør at f.eks. «Mir», «Miranda L» og «Sander S» vises uten å vente
  // på eksternt World Athletics-oppslag.
  const localRanked = rankedResults(merged);
  if (localRanked.length) {
    const top = merged.get(String(localRanked[0].id));
    if ((top?._score || 0) >= 9000) {
      return json({ok:true,results:localRanked,source:'local-prefix'});
    }
  }

  try {
    const primary = await searchWa(q, 900);
    mergeAthletes(merged, primary, qNorm, qTokens, sexFilter);

    if (primary.length || merged.size) {
      return json({ok:true,results:rankedResults(merged),source:'primary'});
    }

    if (parts.length > 1) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      const fallbacks = [...new Set([
        last.length >= 2 ? last : '',
        first,
        `${last} ${first}`
      ].map(s=>s.trim()).filter(Boolean))];

      const settled = await Promise.allSettled(fallbacks.map(name=>searchWa(name, 700)));
      for (const response of settled) {
        if (response.status === 'fulfilled') mergeAthletes(merged, response.value, qNorm, qTokens, sexFilter);
      }
    }

    return json({ok:true,results:rankedResults(merged),source:'fallback'});
  } catch (e) {
    return json({ok:true,results:rankedResults(merged),source:'local-fallback',warning:String(e?.message||e)});
  }
}

function mergeAthletes(merged, raws, qNorm, qTokens, sexFilter='') {
  for (const raw of raws || []) {
    const a = mapAthlete(raw);
    if (!a) continue;
    if (sexFilter && a.sex && String(a.sex).toUpperCase() !== sexFilter) continue;
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
      headers:{'User-Agent':'Mozilla/5.0 Rankingstevner/0.17.0','Accept':'application/json'}
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
    sex: normalizeSex(a.sex ?? a.gender ?? null),
    birthDate: a.birthDate ?? a.dateOfBirth ?? null,
    disciplines: Array.isArray(a.disciplines) ? a.disciplines : []
  };
}

function normalizeSex(v){
  const s=String(v||'').toUpperCase();
  if(s==='M'||s==='MALE'||s==='MEN') return 'M';
  if(s==='W'||s==='F'||s==='FEMALE'||s==='WOMEN') return 'W';
  return null;
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
  if (full === qNorm) score += 12000;
  if (full.startsWith(qNorm)) score += 10000;
  else if (full.includes(qNorm)) score += 5000;

  let allTokens = true;
  for (const token of qTokens) {
    if (!token) continue;
    if (first.startsWith(token) || last.startsWith(token)) score += 1500;
    else if (full.includes(token)) score += 500;
    else allTokens = false;
  }
  if (allTokens && qTokens.length > 1) score += 5000;

  const lastQuery = qTokens[qTokens.length - 1];
  if (qTokens.length > 1 && lastQuery) {
    if (last.startsWith(lastQuery)) score += 8000 + Math.min(lastQuery.length, 8) * 350;
    else if (last.includes(lastQuery)) score += 1500;
    else return 0;
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
