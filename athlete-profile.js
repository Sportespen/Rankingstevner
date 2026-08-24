// Rankingstevner v0.7.7 – stabil WA-profil + verifisert rankingplassering
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

    const basisHtml = scores.length
      ? `<div style="margin-top:10px;padding:10px;border-radius:8px;background:#eef8f5"><strong>Rankinggrunnlag – trinn 1:</strong> gjeldende Ranking Score er hentet. Neste trinn er de individuelle tellende Performance Scores.</div>`
      : `<div class="muted" style="margin-top:8px">Rankingplasseringen er hentet fra strukturert WA-data. Ranking Score kobles inn som neste separate datasteg.</div>`;

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
    waStatus.textContent = 'Henter World Athletics-profil og ranking…';
    try {
      const [profileRes, rankRes] = await Promise.all([
        fetch(`/api/athlete?id=${encodeURIComponent(id)}&v=077`, {cache:'no-store'}),
        fetch(`/api/wa-rank?id=${encodeURIComponent(id)}&v=077`, {cache:'no-store'})
      ]);
      const data = await profileRes.json();
      const rankData = await rankRes.json();
      if (!data.ok) throw new Error(data.error || 'Profiloppslag feilet');

      if (rankData?.ok && Array.isArray(rankData.currentWorldRankings)) {
        data.rankings = rankData.currentWorldRankings.map(r => ({
          rank: Number(r.place),
          event: normalizeProxyEventGroup(r.eventGroup)
        })).filter(r => Number.isFinite(r.rank) && r.event);
        if (!data.sex && rankData.sex) data.sex = rankData.sex;
        data.rankingSource = rankData.source;
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
      selectBestMatchingEvent((data.rankings?.length ? data.rankings : data.rankingScores) || []);
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
