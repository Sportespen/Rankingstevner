// Rankingstevner v0.4 – WA-validering + lokal utøverprofil
(function () {
  function close(a, b) { return Math.abs(a - b) < 1e-9; }
  const tests = [
    ["-4", 24],
    ["-1", 6],
    ["0", 0],
    ["+2,0", 0],
    ["+2,1", -12.6],
    ["+3", -18],
    ["NWI", -30]
  ];

  function runValidation() {
    let passed = 0;
    for (const [input, expected] of tests) {
      const actual = windModFor(input);
      if (actual != null && close(actual, expected)) passed++;
      else console.error("WA vindtest feilet", {input, expected, actual});
    }
    const status = document.getElementById("dataStatus");
    if (!status) return;
    status.textContent = passed === tests.length
      ? `WA 2026 validert · ${passed}/${tests.length} vindtester bestått`
      : `Vindvalidering feilet · ${passed}/${tests.length}`;
  }

  function installProfileUI() {
    const calc = document.querySelector("section.panel.calculator");
    if (!calc || document.getElementById("athleteProfile")) return;

    const profile = document.createElement("div");
    profile.id = "athleteProfile";
    profile.style.marginBottom = "24px";
    profile.style.padding = "18px";
    profile.style.border = "1px solid #dce2e8";
    profile.style.borderRadius = "14px";
    profile.style.background = "#f8fafb";
    profile.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:260px">
          <span class="eyebrow">UTØVERPROFIL</span>
          <h4 style="margin:5px 0 12px;font-size:20px">Lagre rankinggrunnlaget ditt</h4>
          <label>Navn
            <input id="profileName" type="text" placeholder="f.eks. Ola Nordmann" style="margin-top:7px" />
          </label>
          <p id="profileStatus" class="muted" style="margin:8px 0 0">Ingen lagret profil ennå.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="saveProfile" class="primary" type="button">Lagre profil og scores</button>
          <button id="clearProfile" class="secondary" type="button">Nullstill profil</button>
        </div>
      </div>
      <p class="muted" style="margin:12px 0 0">Profilen lagres bare i denne nettleseren. Når du kommer tilbake til samme øvelse, fylles de lagrede Performance Scores automatisk inn.</p>
    `;

    const head = calc.querySelector(".section-head");
    head.insertAdjacentElement("afterend", profile);

    const s = document.createElement("script");
    s.src = `athlete-profile.js?v=040-${Date.now()}`;
    document.body.appendChild(s);
  }

  function setVersion() {
    document.title = "Rankingstevner – prototype v0.4";
    const badge = document.querySelector(".badge");
    if (badge) badge.textContent = "Prototype v0.4";
    const notice = document.querySelector(".notice");
    if (notice) notice.innerHTML = "<strong>v0.4:</strong> Vindmotoren er validert mot WA 2026, og du kan nå lagre en lokal utøverprofil med Performance Scores per øvelse. Profilen fylles automatisk inn neste gang du åpner samme øvelse i denne nettleseren.";
    document.querySelectorAll(".panel .muted").forEach(el => {
      if (el.textContent.includes("Demodata i v0.3.3")) el.textContent = "Demodata i v0.4";
    });
  }

  function boot() {
    setVersion();
    installProfileUI();
    setTimeout(runValidation, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
