// Rankingstevner v0.3.3 – automatisk validering mot World Athletics 2026 vindregler
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

  let passed = 0;
  for (const [input, expected] of tests) {
    const actual = windModFor(input);
    if (actual != null && close(actual, expected)) passed++;
    else console.error("WA vindtest feilet", {input, expected, actual});
  }

  const status = document.getElementById("dataStatus");
  if (status && passed === tests.length) {
    status.textContent = `WA 2026 validert · ${passed}/${tests.length} vindtester bestått`;
  } else if (status) {
    status.textContent = `Vindvalidering feilet · ${passed}/${tests.length}`;
  }
})();
