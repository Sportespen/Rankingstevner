// Rankingstevner v0.7.4 – WA-vindvalidering uten UI-/versjonsoverstyring
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
      else console.error("WA vindtest feilet", { input, expected, actual });
    }

    const status = document.getElementById("dataStatus");
    if (!status) return;
    status.textContent = passed === tests.length
      ? `WA 2026 validert · ${passed}/${tests.length} vindtester bestått`
      : `Vindvalidering feilet · ${passed}/${tests.length}`;
  }

  function boot() {
    setTimeout(runValidation, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
