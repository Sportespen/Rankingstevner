// Verified historical competition level for selected meetings.
// Only values backed by official World Athletics result pages are shown.
(() => {
'use strict';
const HISTORY = [
  {
    match: /decastar/i,
    event: 'Decathlon',
    sex: 'M',
    year: 2025,
    winner: 'Ayden Owens-Delerme',
    winnerMark: 8478,
    top3: [8478,8236,8177],
    top8: [8478,8236,8177,8123,8102,8020,7994,7903],
    source: 'https://worldathletics.org/competition/calendar-results/results/7196994?eventId=10229629'
  },
  {
    match: /decastar/i,
    event: 'Heptathlon',
    sex: 'W',
    year: 2025,
    winner: 'Martha Araujo',
    winnerMark: 6451,
    top3: [6451,6365,6283],
    top8: [6451,6365,6283,6271,6195,6190,6083,6017],
    source: 'https://worldathletics.org/competition/calendar-results/results/7196994?eventId=10229536'
  },
  {
    match: /german combined events championships|german championships/i,
    event: 'Decathlon',
    sex: 'M',
    year: 2025,
    winner: 'Tim Nowak',
    winnerMark: 8140,
    top3: [8140,7579,7510],
    top8: [8140,7579,7510,7338,7226,6998,6907,6872],
    source: 'https://worldathletics.org/competition/calendar-results/results/7229381?day=2'
  }
];
function avg(a){return Math.round(a.reduce((s,x)=>s+x,0)/a.length);}
function eventCode(){return document.getElementById('event')?.value||'';}
function sex(){return document.getElementById('sex')?.value||'M';}
function get(name){return HISTORY.find(h=>h.match.test(String(name||''))&&h.event===eventCode()&&h.sex===sex())||null;}
window.RankingstevnerMeetHistory={
  get,
  html(name){const h=get(name);if(!h)return '<strong>Historiske resultater er ikke verifisert ennå.</strong><small>Vises først når vi har en offisiell World Athletics-kilde.</small>';
    return `<strong>${h.year}: vinner ${h.winnerMark} p · topp 3 snitt ${avg(h.top3)} p · topp 8 snitt ${avg(h.top8)} p</strong><small>Vinner: ${h.winner}. <a href="${h.source}" target="_blank" rel="noopener">Se offisielle WA-resultater</a></small>`;
  }
};
})();
