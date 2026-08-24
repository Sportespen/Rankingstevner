// Rankingstevner v0.6 – lokal utøverprofil + World Athletics-profiloppslag
(function () {
  const VERSION = 'v0.6';
  const STORAGE_KEY = "rankingstevner.profile.v1";
  const profileName = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatus");
  const saveProfileBtn = document.getElementById("saveProfile");
  const clearProfileBtn = document.getElementById("clearProfile");
  const sex = document.getElementById("sex");
  const eventSelect = document.getElementById("event");

  // Synlig versjon styres også fra JS, slik at den ikke kan henge igjen på en gammel HTML-etikett.
  const badge = document.querySelector('.badge');
  if (badge) badge.textContent = `Prototype ${VERSION}`;
  document.title = `Rankingstevner – prototype ${VERSION}`;

  if (!profileName || !profileStatus || !saveProfileBtn || !clearProfileBtn || !sex || !eventSelect) return;

  const profileBox = profileName.closest('div')?.parentElement || profileName.parentElement;
  if (profileBox && !document.getElementById('waProfileId')) {
    const wa = document.createElement('div');
    wa.style.marginTop = '14px';
    wa.innerHTML = `
      <div style="font-weight:800;margin-bottom:6px">World Athletics-profil</div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end">
        <label style="margin:0">WA-ID eller profil-lenke
          <input id="waProfileId" type="text" placeholder="f.eks. 14989292 eller lim inn WA-lenke" />
        </label>
        <button id="loadWaProfile" class="secondary" type="button">Hent fra WA</button>
      </div>
      <div id="waProfileStatus" class="muted" style="margin-top:7px">Henter navn, kjønn, gjeldende rangeringer og profilresultater fra World Athletics.</div>
      <div id="waProfileDetails" style="display:none;margin-top:10px;padding:12px;border:1px solid #d9e5e1;border-radius:10px;background:#fff"></div>
    `;
    profileBox.appendChild(wa);
  }

  const waInput = document.getElementById('waProfileId');
  const waBtn = document.getElementById('loadWaProfile');
  const waStatus = document.getElementById('waProfileStatus');
  const waDetails = document.getElementById('waProfileDetails');

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
    catch (_) { return {}; }
  }
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
    return String(s || '')
      .toLowerCase()
      .replace(/metres?|meters?/g,'m')
      .replace(/women'?s|woman'?s|men'?s/g,'')
      .replace(/[^a-z0-9]+/g,'');
  }
  function selectBestMatchingEvent(rankings) {
    if (!Array.isArray(rankings) || !rankings.length) return;
    const options = [...eventSelect.options];
    for (const r of rankings) {
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
    const rankingHtml = data.rankings?.length
      ? `<div><strong>Gjeldende WA-ranking:</strong> ${data.rankings.map(r=>`#${r.rank} ${r.event}`).join(' · ')}</div>`
      : '<div><strong>Gjeldende WA-ranking:</strong> ingen ranking funnet på profilsiden.</div>';
    const pbHtml = data.personalBests?.length
      ? `<div style="margin-top:8px"><strong>Profilresultater:</strong><br>${data.personalBests.slice(0,5).map(p=>`${p.event}: ${p.result} · score ${p.score}`).join('<br>')}</div>`
      : '';
    waDetails.innerHTML = rankingHtml + pbHtml + '<div class="muted" style="margin-top:8px">Merk: profilresultatene er ikke de fem tellende Performance Scores. Automatisk henting av selve rankinggrunnlaget bygges i neste datasteg.</div>';
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
  function restoreCurrentEventScores() {
    const store = readStore();
    setTimeout(() => applyScores(store.scores?.[eventKey()]), 25);
  }

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
    waStatus.textContent = 'Henter World Athletics-profil…';
    try {
      const res = await fetch(`/api/athlete?id=${encodeURIComponent(id)}`, {cache:'no-store'});
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Oppslag feilet');
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
      selectBestMatchingEvent(data.rankings || []);
      store.event = eventSelect.value;
      writeStore(store);
      const sexLabel = data.sex === 'W' ? 'Kvinner' : data.sex === 'M' ? 'Menn' : '';
      waStatus.innerHTML = `<strong>WA-profil funnet:</strong> ${data.name || data.id}${sexLabel ? ' · ' + sexLabel : ''}`;
      renderWaDetails(data);
      showStatus(`Koblet til World Athletics: ${data.name || data.id}`);
    } catch (e) {
      waStatus.textContent = `Kunne ikke hente WA-profil: ${e.message}`;
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
