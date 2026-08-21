// Rankingstevner v0.3.2 – tydelig kontroll av Best Legal Jump
(function () {
  const calculateBtn = document.getElementById("calculate");
  const panel = document.getElementById("bljComparison");
  if (!calculateBtn || !panel) return;

  function f(v) {
    if (v == null || !Number.isFinite(v)) return "–";
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  }

  function showComparison() {
    const code = document.getElementById("event")?.value;
    if (code !== "LJ" && code !== "TJ") {
      panel.style.display = "none";
      panel.innerHTML = "";
      return;
    }

    const mark = document.getElementById("mark")?.value || "";
    const wind = document.getElementById("wind")?.value || "";
    const blj = document.getElementById("bljMark")?.value || "";
    const bljWind = document.getElementById("bljWind")?.value || "";

    const finalBase = lookupScoreFor(code, mark);
    const finalMod = windModFor(wind);
    const finalAdjusted = finalBase != null && finalMod != null ? finalBase + finalMod : null;

    const bljBase = blj.trim() ? lookupScoreFor(code, blj) : null;
    const parsedBLJWind = parseWind(bljWind);
    const bljLegal = typeof parsedBLJWind === "number" && parsedBLJWind <= 2.0;
    const bljMod = bljLegal ? windModFor(bljWind) : null;
    const bljAdjusted = bljBase != null && bljMod != null ? bljBase + bljMod : null;

    let chosen = "Sluttresultatet";
    let chosenScore = finalAdjusted;
    if (bljAdjusted != null && finalAdjusted != null && bljAdjusted > finalAdjusted) {
      chosen = "Best Legal Jump";
      chosenScore = bljAdjusted;
    }

    panel.style.display = "block";
    panel.innerHTML = `
      <strong style="display:block;font-size:18px;margin-bottom:12px">Sammenligning av hopp</strong>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div style="padding:14px;border:1px solid #e1e7eb;border-radius:10px">
          <span class="muted">Sluttresultat</span><br>
          <strong style="font-size:18px">${mark || "–"} m (${wind || "–"} m/s)</strong><br>
          <span class="muted">Grunnscore ${f(finalBase)} · vindjustering ${f(finalMod)} · justert ${f(finalAdjusted)}</span>
        </div>
        <div style="padding:14px;border:1px solid #e1e7eb;border-radius:10px">
          <span class="muted">Best Legal Jump</span><br>
          <strong style="font-size:18px">${blj || "–"} m (${bljWind || "–"} m/s)</strong><br>
          <span class="muted">${blj.trim() ? (bljLegal ? `Grunnscore ${f(bljBase)} · vindjustering ${f(bljMod)} · justert ${f(bljAdjusted)}` : "BLJ-vinden er ikke lovlig (må være ≤ +2,0 m/s).") : "Ikke oppgitt."}</span>
        </div>
      </div>
      <div style="margin-top:14px;padding:12px;border-radius:10px;background:#eef9f5;font-weight:900;color:#087f5b">
        Valgt resultat: ${chosen} – ${f(chosenScore)} Result Score
      </div>
    `;
  }

  calculateBtn.addEventListener("click", function () {
    setTimeout(showComparison, 0);
  });
})();
