// Rankingstevner v0.3.1 – tydelig kontroll av Best Legal Jump
(function () {
  const calculateBtn = document.getElementById("calculate");
  const ruleInfo = document.getElementById("ruleInfo");
  if (!calculateBtn || !ruleInfo) return;

  const panel = document.createElement("div");
  panel.id = "bljComparison";
  panel.style.marginTop = "16px";
  panel.style.padding = "16px";
  panel.style.border = "1px solid #cfe2dc";
  panel.style.borderRadius = "12px";
  panel.style.background = "#fff";
  panel.style.display = "none";
  ruleInfo.insertAdjacentElement("afterend", panel);

  function f(v) {
    if (v == null || !Number.isFinite(v)) return "–";
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  }

  function showComparison() {
    const code = document.getElementById("event")?.value;
    if (code !== "LJ" && code !== "TJ") {
      panel.style.display = "none";
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
      <strong style="display:block;font-size:17px;margin-bottom:10px">Best Legal Jump – kontroll</strong>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div style="padding:12px;border:1px solid #e1e7eb;border-radius:10px">
          <span class="muted">Sluttresultat</span><br>
          <strong>${mark || "–"} m (${wind || "–"} m/s)</strong><br>
          <span class="muted">Grunnscore ${f(finalBase)} · vindjustering ${f(finalMod)} · justert ${f(finalAdjusted)}</span>
        </div>
        <div style="padding:12px;border:1px solid #e1e7eb;border-radius:10px">
          <span class="muted">Best Legal Jump</span><br>
          <strong>${blj || "–"} m (${bljWind || "–"} m/s)</strong><br>
          <span class="muted">${blj.trim() ? (bljLegal ? `Grunnscore ${f(bljBase)} · vindjustering ${f(bljMod)} · justert ${f(bljAdjusted)}` : "BLJ-vinden er ikke lovlig (må være ≤ +2,0 m/s).") : "Ikke oppgitt."}</span>
        </div>
      </div>
      <div style="margin-top:12px;font-weight:800;color:#087f5b">Valgt resultat: ${chosen} – ${f(chosenScore)} Result Score</div>
    `;
  }

  calculateBtn.addEventListener("click", function () {
    setTimeout(showComparison, 0);
  });
})();
