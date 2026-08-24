// Rankingstevner v0.8.1 – WA-ranking + automatisk mangekampgrunnlag
(function () {
  const STORAGE_KEY = "rankingstevner.profile.v1";
  const profileName = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatus");
  const saveProfileBtn = document.getElementById("saveProfile");
  const clearProfileBtn = document.getElementById("clearProfile");
  const sex = document.getElementById("sex");
  const eventSelect = document.getElementById("event");
  const waInput = document.getElementById('waProfileId');
  const waBtn = document.getElementById('loadWaProfile');
  const waStatus = document.getElementById('waProfileStatus');
  const waDetails = document.getElementById('waProfileDetails');

  const combinedPlacing = {
    OW:[200,175,160,145,130,120,110,100,67,60,53,46,42,38,35,32],
    DF:[125,105,95,85,75,67,60,53,35,28,24,21],
    GW:[100,85,75,65,56,49,42,35,25,21,17,13],
    GL:[80,65,55,46,39,35,31,28,21,17,14,11],
    A:[56,49,42,35,31,27,24,21,15,13,11,9],
    B:[42,35,31,27,24,21,18,15,13,11,9,8],
    C:[32,27,22,18,15,13,12,11,10,9,8,7],
    D:[21,15,13,11,10,9,8,7],
    E:[14,10,7,6,5,4],
    F:[7,4,2]
  };

  if (!profileName || !profileStatus || !saveProfileBtn || !clearProfileBtn || !sex || !eventSelect) return;

  function readStore() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; } catch (_) { return {}; } }
  function writeStore(store) { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  function eventKey() { return `${sex.value}:${eventSelect.value || ""}`; }
  function collectScores() {
    const scores = [...document.querySelectorAll(".existingScore")];
    const types = [...document.querySelectorAll(".existingType")];
    return scores.map((el, i) => ({score: el.value,type: types[i]?.value || "main"}));
  }
  function applyScores(saved) {
    if (!Array.isArray(saved)) return;
    const scores = [...document.querySelectorAll(".existingScore")];
    const types = [...document.querySelectorAll(".existingType")];
    saved.forEach((item, i) => {
      if (scores[i]) scores[i].value = item?.score ?? "";
      if (types[i]) types[i].value = item?.type === "similar" ? "similar" : "main";
    });
  }
  function showStatus(text, good=true) {
    profileStatus.textContent = text;
    profileStatus.style.color = good ? "#087f5b" : "#677585";
  }
  function normalizeEvent(s) {
    return String(s || '').toLowerCase().replace(/metres?|meters?/g,'m').replace(/women'?s|woman'?s|men'?s/g,'').replace(/[^a-z0-9]+/g,'');
  }
  function normalizeProxyEventGroup(s) {
    return String(s || '')
      .replace(/^Men'?s\s+/i,'')
      .replace(/^Women'?s\s+/i,'')
      .replace(/^Woman'?s\s+/i,'')
      .trim();
  }
  function selectBestMatchingEvent(items) {
    if (!Array.isArray(items) || !items.length) return;
    const options = [...eventSelect.options];
    for (const r of items) {
      const target = normalizeEvent(r.event);
      const match = options.find(o => normalizeEvent(o.textContent) === target || normalizeEvent(o.value) === target);
      if (match) {
        eventSelect.value = match.value;
        eventSelect.dispatchEvent(new Event('change'));
        return;
      }
    }
  }

  function combinedType(discipline, athleteSex) {
    const d = String(discipline || '').toLowerCase().trim();
    if (athleteSex === 'M') {
      if (d === 'decathlon') return 'main';
      if (d.includes('heptathlon short track')) return 'similar';
    }
    if (athleteSex === 'W') {
      if (d === 'heptathlon') return 'main';
      if (d.includes('pentathlon short track')) return 'similar';
    }
    return null;
  }

  function buildCombinedRankingBasis(results, athleteSex) {
    if (!Array.isArray(results)) return null;
    const entries = results.map(r => {
      const type = combinedType(r.discipline, athleteSex);
      const resultScore = Number(r.resultScore);
      const place = Number(r.place);
      const category = String(r.category || '').toUpperCase();
      const placingScore = combinedPlacing[category]?.[place - 1];
      if (!type || r.legal === false || !Number.isFinite(resultScore) || resultScore <= 0 || !Number.isFinite(place) || placingScore == null) return null;
      return {
        score:resultScore + placingScore,
        resultScore,
        placingScore,
        type,
        discipline:r.discipline,
        mark:r.mark,
        place,
        category,
        competition:r.competition,
        date:r.date
      };
    }).filter(Boolean);

    const validPairs=[];
    for(let i=0;i<entries.length;i++){
      for(let j=i+1;j<entries.length;j++){
        const pair=[entries[i],entries[j]];
        if(pair.some(x=>x.type==='main')) validPairs.push(pair);
      }
    }
    if(!validPairs.length) return null;
    validPairs.sort((a,b)=>(b[0].score+b[1].score)-(a[0].score+a[1].score));
    const selected=validPairs[0].sort((a,b)=>b.score-a.score);
    return {selected,rankingScore:Math.floor((selected[0].score+selected[1].score)/2)};
  }

  function applyAutomaticRankingBasis(basis, athleteSex) {
    if (!basis?.selected?.length) return;
    const targetCode = athleteSex === 'W' ? 'Heptathlon' : 'Decathlon';
    if ([...eventSelect.options].some(o=>o.value===targetCode)) {
      eventSelect.value = targetCode;
      eventSelect.dispatchEvent(new Event('change'));
    }
    setTimeout(() => {
      const scores=[...document.querySelectorAll('.existingScore')];
      const types=[...document.querySelectorAll('.existingType')];
      basis.selected.forEach((item,i)=>{
        if(scores[i]) scores[i].value=String(item.score);
        if(types[i]) types[i].value=item.type;
      });
      const store=readStore();
      store.scores=store.scores||{};
      store.scores[eventKey()]=collectScores();
      store.event=eventSelect.value;
      writeStore(store);
    },150);
  }

  function renderWaDetails(data) {
    if (!waDetails) return;
    const scores = data.rankingScores || [];
    const scoreByEvent = new Map(scores.map(r => [normalizeEvent(r.event), r]));

    let rankingHtml = '';
    if (data.rankings?.length) {
      rankingHtml = `<div><strong>Gjeldende WA-ranking:</strong><br>${data.rankings.map(r=>{
        const rs = scoreByEvent.get(normalizeEvent(r.event));
        return `#${r.rank} ${r.event}${rs?.score ? ` · <strong>${rs.score} Ranking Score</strong>` : ''}`;
      }).join('<br>')}</div>`;
    } else if (scores.length) {
      rankingHtml = `<div><strong>Gjeldende WA-ranking:</strong><br>${scores.map(r=>`${r.rank ? `#${r.rank} ` : ''}${r.event} · <strong>${r.score} Ranking Score</strong>`).join('<br>')}</div>`;
    } else {
      rankingHtml = '<div><strong>Gjeldende WA-ranking:</strong> ikke funnet sikkert.</div>';
    }

    const pbHtml = data.personalBests?.length
      ? `<div style="margin-top:8px"><strong>Sikre profilresultater:</strong><br>${data.personalBests.slice(0,8).map(p=>`${p.event}: ${p.result} · score ${p.score}`).join('<br>')}</div>`
      : '<div style="margin-top:8px"><strong>Profilresultater:</strong> ingen sikre resultatrader funnet.</div>';

    let basisHtml='';
    if(data.combinedBasis?.selected?.length){
      const rows=data.combinedBasis.selected.map(x=>`${x.mark} ${x.discipline} · ${x.resultScore} Result Score + ${x.placingScore} Placing Score = <strong>${x.score} Performance Score</strong> (${x.type==='main'?'Main Event':'Similar Event'})`).join('<br>');
      basisHtml=`<div style="margin-top:10px;padding:10px;border-radius:8px;background:#eef8f5"><strong>Automatisk rankinggrunnlag:</strong><br>${rows}<br><strong>Ranking Score: ${data.combinedBasis.rankingScore}</strong></div>`;
    } else if (scores.length) {
      basisHtml = `<div style="margin-top:10px;padding:10px;border-radius:8px;background:#eef8f5"><strong>Rankinggrunnlag:</strong> gjeldende Ranking Score er hentet.</div>`;
    } else {
      basisHtml = `<div class="muted" style="margin-top:8px">Rankingplasseringen er hentet fra strukturert WA-data. Rankinggrunnlaget kunne ikke bygges automatisk.</div>`;
    }

    waDetails.innerHTML = rankingHtml + pbHtml + basisHtml;
    waDetails.style.display = 'block';
  }

  function restoreProfile() {
    const store = readStore();
    if (store.name) profileName.value = store.name;
    if (waInput && store.waId) waInput.value = store.waId;
    if (store.sex && [...sex.options].some(o => o.value === store.sex)) sex.value = store.sex;
    if (store.name) showStatus(`Profil lastet: ${store.name}`); else showStatus("Ingen lagret profil ennå.", false);
    if (waStatus && store.waName) waStatus.textContent = `WA koblet: ${store.waName}`;
    if (store.waData) renderWaDetails(store.waData);
    setTimeout(() => {
      if (store.event && [...eventSelect.options].some(o => o.value === store.event)) {
        eventSelect.value = store.event;
        eventSelect.dispatchEvent(new Event("change"));
      }
      setTimeout(() => applyScores(store.scores?.[eventKey()]), 50);
    }, 250);
  }
  function restoreCurrentEventScores() { const store = readStore(); setTimeout(() => applyScores(store.scores?.[eventKey()]), 25); }

  saveProfileBtn.addEventListener("click", () => {
    const name = profileName.value.trim();
    const store = readStore();
    store.name = name || "Utøver";
    store.sex = sex.value;
    store.event = eventSelect.value;
    store.scores = store.scores || {};
    store.scores[eventKey()] = collectScores();
    if (waInput?.value.trim()) store.waId = waInput.value.trim();
    writeStore(store);
    showStatus(`Lagret for ${store.name}: ${eventSelect.options[eventSelect.selectedIndex]?.text || "øvelse"}`);
  });

  clearProfileBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    profileName.value = "";
    if (waInput) waInput.value = "";
    if (waStatus) waStatus.textContent = "Ingen WA-profil koblet.";
    if (waDetails) { waDetails.innerHTML = ''; waDetails.style.display = 'none'; }
    document.querySelectorAll(".existingScore").forEach(el => el.value = "");
    document.querySelectorAll(".existingType").forEach(el => el.value = "main");
    showStatus("Profil og lagrede scores er slettet.", false);
  });

  if (waBtn) waBtn.addEventListener('click', async () => {
    const raw = waInput.value.trim();
    const id = raw.match(/(\d{7,9})/)?.[1];
    if (!id) { waStatus.textContent = 'Skriv inn en gyldig WA-ID eller profil-lenke.'; return; }
    waBtn.disabled = true;
    waStatus.textContent = 'Henter World Athletics-profil og rankinggrunnlag…';
    try {
      const [profileRes, rankRes, resultsRes] = await Promise.all([
        fetch(`/api/athlete?id=${encodeURIComponent(id)}&v=081`, {cache:'no-store'}),
        fetch(`/api/wa-rank?id=${encodeURIComponent(id)}&v=081`, {cache:'no-store'}),
        fetch(`/api/wa-results?id=${encodeURIComponent(id)}&v=081`, {cache:'no-store'})
      ]);
      const data = await profileRes.json();
      const rankData = await rankRes.json();
      const resultsData = await resultsRes.json();
      if (!data.ok) throw new Error(data.error || 'Profiloppslag feilet');

      if (rankData?.ok && Array.isArray(rankData.currentWorldRankings)) {
        data.rankings = rankData.currentWorldRankings.map(r => ({
          rank: Number(r.place),
          event: normalizeProxyEventGroup(r.eventGroup)
        })).filter(r => Number.isFinite(r.rank) && r.event);
        if (!data.sex && rankData.sex) data.sex = rankData.sex;
        data.rankingSource = rankData.source;
      }

      if(resultsData?.ok && Array.isArray(resultsData.combined)){
        const basis=buildCombinedRankingBasis(resultsData.combined,data.sex);
        if(basis){
          data.combinedBasis=basis;
          const combinedRanking=(data.rankings||[]).find(r=>/decathlon|heptathlon/i.test(String(r.event||'')));
          data.rankingScores=[{
            event:data.sex==='W'?'Heptathlon':'Decathlon',
            rank:combinedRanking?.rank ?? null,
            score:basis.rankingScore,
            source:'calculated-from-wa-results'
          }];
        }
      }

      const store = readStore();
      store.waId = data.id;
      store.waName = data.name || store.name || '';
      store.waUrl = data.url;
      store.waRankings = data.rankings || [];
      store.waData = data;
      if (data.name) { profileName.value = data.name; store.name = data.name; }
      if (data.sex && [...sex.options].some(o=>o.value===data.sex)) {
        sex.value = data.sex;
        sex.dispatchEvent(new Event('change'));
        store.sex = data.sex;
      }
      if(data.combinedBasis) applyAutomaticRankingBasis(data.combinedBasis,data.sex);
      else selectBestMatchingEvent((data.rankings?.length ? data.rankings : data.rankingScores) || []);
      store.event = eventSelect.value;
      writeStore(store);
      const sexLabel = data.sex === 'W' ? 'Kvinner' : data.sex === 'M' ? 'Menn' : '';
      waStatus.innerHTML = `<strong>WA-profil funnet:</strong> ${data.name || data.id}${sexLabel ? ' · ' + sexLabel : ''}`;
      renderWaDetails(data);
      showStatus(`Koblet til World Athletics: ${data.name || data.id}`);
    } catch (e) {
      waStatus.textContent = `Kunne ikke hente WA-profil: ${e.message}`;
      if (waDetails) { waDetails.innerHTML=''; waDetails.style.display='none'; }
    } finally { waBtn.disabled = false; }
  });

  sex.addEventListener("change", () => {
    const store = readStore();
    store.sex = sex.value;
    writeStore(store);
    setTimeout(restoreCurrentEventScores, 100);
  });
  eventSelect.addEventListener("change", () => setTimeout(restoreCurrentEventScores, 40));

  const wait = setInterval(() => {
    if (eventSelect.options.length) {
      clearInterval(wait);
      restoreProfile();
    }
  }, 100);
  setTimeout(() => clearInterval(wait), 10000);
})();
