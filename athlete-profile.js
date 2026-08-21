// Rankingstevner v0.5 – lokal utøverprofil + World Athletics-profiloppslag
(function () {
  const STORAGE_KEY = "rankingstevner.profile.v1";
  const profileName = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatus");
  const saveProfileBtn = document.getElementById("saveProfile");
  const clearProfileBtn = document.getElementById("clearProfile");
  const sex = document.getElementById("sex");
  const eventSelect = document.getElementById("event");

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
      <div id="waProfileStatus" class="muted" style="margin-top:7px">Første steg: henter og bekrefter riktig WA-profil og gjeldende rangeringer.</div>
    `;
    profileBox.appendChild(wa);
  }

  const waInput = document.getElementById('waProfileId');
  const waBtn = document.getElementById('loadWaProfile');
  const waStatus = document.getElementById('waProfileStatus');

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
  function restoreProfile() {
    const store = readStore();
    if (store.name) profileName.value = store.name;
    if (waInput && store.waId) waInput.value = store.waId;
    if (store.sex && [...sex.options].some(o => o.value === store.sex)) sex.value = store.sex;
    if (store.name) showStatus(`Profil lastet: ${store.name}`); else showStatus("Ingen lagret profil ennå.", false);
    if (waStatus && store.waName) waStatus.textContent = `WA koblet: ${store.waName}${store.waRankings?.length ? ' · ' + store.waRankings.map(r=>`#${r.rank} ${r.event}`).join(' · ') : ''}`;
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
      if (data.name) { profileName.value = data.name; store.name = data.name; }
      writeStore(store);
      waStatus.innerHTML = `<strong>WA-profil funnet:</strong> ${data.name || data.id}${data.rankings?.length ? '<br>' + data.rankings.map(r=>`#${r.rank} ${r.event}`).join(' · ') : ''}`;
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