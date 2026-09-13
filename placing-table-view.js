// Lets the user open the raw WA Placing Score table (per stevnekategori, per plassering) for
// whichever event is currently selected in "Velg øvelse for ranking" - so they can see the
// underlying numbers app.js already uses instead of only the calculated result. Reads
// `placingTables`/`activeGroup`/`requirements` straight off app.js's top-level scope (all classic
// scripts on this page share one global scope, so no window.* plumbing is needed) rather than
// duplicating that data here.
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('togglePlacingTable');
  const box = document.getElementById('placingTableBox');
  const eventSelect = document.getElementById('event');
  const sex = document.getElementById('sex');
  if (!toggleBtn || !box) return;

  const CATEGORY_LABELS = {OW:'OW',DF:'DF',GW:'GW',GL:'GL',A:'A',B:'B',C:'C',D:'D',E:'E',F:'F'};

  function renderTable() {
    const table = (typeof placingTables !== 'undefined') ? placingTables[activeGroup] : null;
    if (!table) { box.innerHTML = '<p class="muted">Fant ingen rankingtabell for denne øvelsen.</p>'; return; }
    const cols = Math.max(0, ...Object.values(table).map(a => a.length));
    const groupLabel = (typeof requirements !== 'undefined' && requirements[activeGroup]) ? requirements[activeGroup].label : activeGroup;
    const head = Array.from({length: cols}, (_, i) => `<th style="text-align:right;padding:6px 8px">${i + 1}.</th>`).join('');
    const rows = Object.keys(CATEGORY_LABELS)
      .filter(cat => Array.isArray(table[cat]))
      .map(cat => {
        const values = table[cat];
        const cells = Array.from({length: cols}, (_, i) => `<td style="text-align:right;padding:6px 8px">${values[i] ?? '–'}</td>`).join('');
        return `<tr style="border-top:1px solid #21405f"><td style="padding:6px 8px;font-weight:700">${CATEGORY_LABELS[cat]}</td>${cells}</tr>`;
      }).join('');
    box.innerHTML = `<div style="margin-top:4px"><strong>Placing Score - ${groupLabel}:</strong><div style="overflow-x:auto;margin-top:7px"><table style="border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px 8px">Kat.</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function refreshIfOpen() {
    if (box.style.display !== 'none') renderTable();
  }

  toggleBtn.addEventListener('click', () => {
    const opening = box.style.display === 'none';
    box.style.display = opening ? '' : 'none';
    toggleBtn.textContent = opening ? 'Skjul rankingtabell' : 'Vis rankingtabell';
    if (opening) renderTable();
  });

  eventSelect?.addEventListener('change', () => setTimeout(refreshIfOpen, 0));
  sex?.addEventListener('change', () => setTimeout(refreshIfOpen, 0));
});
