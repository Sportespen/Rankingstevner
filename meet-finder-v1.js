// Stevnefinner v5.8 – future-only, U23/senior-only, venue filter, green filters + duplicate protection.
(() => {
'use strict';
const WA_CALENDAR='https://worldathletics.org/competition/calendar-results';
// The next championship depends on arena: outdoor results count toward the World
// Championships (Beijing, Sep 2027), indoor results toward the European Indoor
// Championships (Valencia, Mar 2027) - two different events, two different qualification
// systems. Entry standards confirmed for outdoor combined events (WA qualification system,
// Aug 2026); Valencia 2027's own combined-event standards weren't published yet when this
// was written, so that case links out to EA's page instead of showing a possibly-wrong number.
// `body` (WA/EA) picks which federation's Toplist the WA/EA button links to for that arena -
// this flips in cycles where the Worlds are indoor and the Euros outdoor, so when updating
// for a later championship cycle, only this object should need to change.
const CHAMPIONSHIP={
  outdoor:{
    body:'WA',
    name:'Beijing 2027',
    // Qualification rules/standards (press release) vs. the live "Road to Beijing 27"
    // qualification tracker (published in WA's Stats Zone) - two different official pages.
    qualificationUrl:'https://worldathletics.org/competitions/world-athletics-championships/beijing27/news/press-releases/qualification-system-world-athletics-championships-beijing-27',
    roadUrl:'https://worldathletics.org/stats-zone',
    entryStandards:{Decathlon:8620,Heptathlon:6550},
    rankingUrl:{Decathlon:'https://worldathletics.org/world-rankings/decathlon/men',Heptathlon:'https://worldathletics.org/world-rankings/heptathlon/women'},
    // Beijing 27's own target field size per event isn't published anywhere reachable from
    // here, so this uses the confirmed number of starters at the previous edition (Tokyo 25,
    // per Wikipedia) as a stand-in - labelled as such below, not shown as Beijing's own quota.
    previousChampionship:'Tokyo 2025',
    previousFieldSize:{Decathlon:24,Heptathlon:24},
  },
  indoor:{
    body:'EA',
    name:'Valencia 2027',
    // EA doesn't publish a separate "Road to Valencia" tracker page (confirmed by search) -
    // both links fall back to the same official championship page.
    qualificationUrl:'https://www.european-athletics.com/home/competitions/european-athletics-indoor-championships-2027/valencia',
    roadUrl:'https://www.european-athletics.com/home/competitions/european-athletics-indoor-championships-2027/valencia',
    entryStandards:{},
    rankingUrl:{},
    // Same approach as outdoor: Valencia 27's own quota isn't published, so this falls back
    // to the previous European Indoor Championships (Apeldoorn 25, per Wikipedia) - men's
    // indoor Heptathlon and women's indoor Pentathlon both had 14 starters. This app doesn't
    // distinguish indoor Pentathlon from outdoor Heptathlon in its event codes, so the lookup
    // below reuses the same Decathlon/Heptathlon keys as outdoor.
    previousChampionship:'Apeldoorn 2025',
    previousFieldSize:{Decathlon:14,Heptathlon:14},
  },
};
// EA has no confirmed per-event deep-link pattern (unlike WA's toplists path), so the EA
// Toplist button goes to their general Top Lists page rather than a guessed filtered URL.
const EA_TOPLIST_URL='https://www.european-athletics.com/home/historical-data/top-lists';
const MAX_DATE=new Date('2027-12-31T23:59:59');
let allMeets=[];let loading=false;let loadError='';let loadedAt=null;
// render() rebuilds every meet card from scratch on each call (filter change, athlete switch via
// the waStatus MutationObserver, the 15-minute auto-refresh, ...), and used to re-fetch every
// visible card's contact/program info all over again each time even when nothing about that
// specific meet had changed - the actual cause of "øvelsesutvalget" feeling slow to load,
// especially with several cards on screen. A meet's own contact/program data doesn't change
// within a browsing session, so this caches the rendered HTML per meet id and skips the network
// call entirely on a repeat render.
const meetDetailsCache=new Map();
const $=id=>document.getElementById(id);
const eventCode=()=>$('event')?.value||'';
const eventLabel=()=>$('event')?.selectedOptions?.[0]?.textContent||'valgt øvelse';
const sexCode=()=>$('sex')?.value||'M';
// The <option> text for Decathlon/Heptathlon is relabelled to the shared ranking-group
// name "Mangekamp" for the calculator (see combined-venue-labels.js). Per-meet cards need
// the actual specific event instead, so it's kept separate from eventLabel() here.
// "Heptathlon" itself is ambiguous: WA uses it for both the men's indoor combined event
// (7 disciplines) and the women's outdoor one (7 disciplines) - they aren't the same
// competition. The actual name per meet depends on arena (indoor/outdoor) + sex:
//   outdoor: Tikamp (menn, 10 øvelser) / Sjukamp (damer, 7 øvelser)
//   indoor:  Sjukamp (menn, 7 øvelser) / Femkamp (damer, 5 øvelser)
function perMeetEventLabel(m){
  if(eventCode()!=='Decathlon'&&eventCode()!=='Heptathlon')return eventLabel();
  const indoor=venueType(m)==='indoor';
  const woman=sexCode()==='W';
  if(indoor)return woman?'Femkamp':'Sjukamp';
  return woman?'Sjukamp':'Tikamp';
}
function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function disciplineBlob(m){return (Array.isArray(m?.disciplines)?m.disciplines:[]).map(d=>norm(typeof d==='string'?d:JSON.stringify(d))).join(' | ');}
function hasAny(s,items){return items.some(x=>s.includes(norm(x)));}
function eventMatches(m,code){const s=disciplineBlob(m);if(!s)return false;switch(code){case'100m':return hasAny(s,['100 m','100m','100 metres','100 meters'])&&!s.includes('hurd');case'200m':return hasAny(s,['200 m','200m','200 metres','200 meters'])&&!s.includes('hurd');case'400m':return hasAny(s,['400 m','400m','400 metres','400 meters'])&&!s.includes('hurd');case'800m':return hasAny(s,['800 m','800m','800 metres','800 meters']);case'1500m':return hasAny(s,['1500 m','1500m']);case'5000m':return hasAny(s,['5000 m','5000m']);case'10000m':return hasAny(s,['10000 m','10000m','10 000 m']);case'100mH':return hasAny(s,['100 m hurdles','100m hurdles'])||/100 ?m.*hurd/.test(s);case'110mH':return hasAny(s,['110 m hurdles','110m hurdles'])||/110 ?m.*hurd/.test(s);case'400mH':return hasAny(s,['400 m hurdles','400m hurdles'])||/400 ?m.*hurd/.test(s);case'3000mSC':return hasAny(s,['3000 m steeplechase','3000m steeplechase']);case'HJ':return hasAny(s,['high jump']);case'PV':return hasAny(s,['pole vault']);case'LJ':return hasAny(s,['long jump']);case'TJ':return hasAny(s,['triple jump']);case'SP':return hasAny(s,['shot put']);case'DT':return hasAny(s,['discus throw','discus']);case'HT':return hasAny(s,['hammer throw','hammer']);case'JT':return hasAny(s,['javelin throw','javelin']);case'Decathlon':return hasAny(s,['decathlon','combined events']);case'Heptathlon':return hasAny(s,['heptathlon','combined events']);default:return false;}}
function parseDate(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
function dateKey(v){const d=parseDate(v);return d?d.toISOString().slice(0,10):'';}
function isFutureThrough2027(m){const today=new Date();today.setHours(0,0,0,0);const end=parseDate(m.end)||parseDate(m.start);const start=parseDate(m.start)||end;return!!(end&&start&&end>=today&&start<=MAX_DATE);}
const EUROPE_CODES=new Set(['ALB','AND','ARM','AUT','BLR','BEL','BIH','BUL','CRO','CYP','CZE','DEN','EST','FIN','FRA','GEO','GER','GIB','GBR','GRE','HUN','ISL','IRL','ITA','KOS','LAT','LIE','LTU','LUX','MLT','MDA','MON','MNE','NED','MKD','NOR','POL','POR','ROU','SMR','SRB','SVK','SLO','ESP','SWE','SUI','TUR','UKR']);
// Same order as the calculator's own #category select (index.html), so the finder's filter
// always offers the full, correctly-ordered WA ranking category set instead of only whatever
// categories happen to appear in the current search results.
const RANKING_CATEGORIES=['OW','DF','GW','GL','A','B','C','D','E','F'];
const COUNTRY_NAMES={ALB:'Albania',AND:'Andorra',ARM:'Armenia',AUT:'Østerrike',BLR:'Belarus',BEL:'Belgia',BIH:'Bosnia-Hercegovina',BUL:'Bulgaria',CRO:'Kroatia',CYP:'Kypros',CZE:'Tsjekkia',DEN:'Danmark',EST:'Estland',FIN:'Finland',FRA:'Frankrike',GEO:'Georgia',GER:'Tyskland',GIB:'Gibraltar',GBR:'Storbritannia',GRE:'Hellas',HUN:'Ungarn',ISL:'Island',IRL:'Irland',ITA:'Italia',KOS:'Kosovo',LAT:'Latvia',LIE:'Liechtenstein',LTU:'Litauen',LUX:'Luxembourg',MLT:'Malta',MDA:'Moldova',MON:'Monaco',MNE:'Montenegro',NED:'Nederland',MKD:'Nord-Makedonia',NOR:'Norge',POL:'Polen',POR:'Portugal',ROU:'Romania',SMR:'San Marino',SRB:'Serbia',SVK:'Slovakia',SLO:'Slovenia',ESP:'Spania',SWE:'Sverige',SUI:'Sveits',TUR:'Tyrkia',UKR:'Ukraina'};
const EUROPE_NAMES=['albania','andorra','armenia','austria','belarus','belgium','bosnia','bulgaria','croatia','cyprus','czech','denmark','estonia','finland','france','georgia','germany','gibraltar','greece','hungary','iceland','ireland','italy','kosovo','latvia','liechtenstein','lithuania','luxembourg','malta','moldova','monaco','montenegro','netherlands','north macedonia','norway','poland','portugal','romania','san marino','serbia','slovakia','slovenia','spain','sweden','switzerland','turkey','turkiye','ukraine','united kingdom','england','scotland','wales','northern ireland'];
function locationText(m){const loc=m?.location;if(!loc)return'';if(typeof loc==='string')return loc;if(typeof loc==='object')return [loc.venue,loc.city,loc.country,loc.countryCode,loc.area].filter(Boolean).join(' ');return String(loc);}
function countryCode(m){
  const raw=[locationText(m),m?.area,m?.country,m?.countryCode].filter(Boolean).join(' ');
  // WA venue strings almost always end "... (CODE)" - prefer that over scanning every word,
  // since ordinary English words collide with 3-letter codes (esp. "and" == AND/Andorra,
  // which wrongly flagged e.g. "Harvard-Gordon Track and Tennis Center" as European).
  const paren=raw.match(/\(([A-Z]{3})\)/);
  if(paren)return EUROPE_CODES.has(paren[1])?paren[1]:'';
  const STOPWORDS=new Set(['AND','ARM','DEN','FIN','FOR','THE','AGE']);
  const tokens=String(raw).toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/);
  return tokens.find(t=>EUROPE_CODES.has(t)&&!STOPWORDS.has(t))||'';
}
function isEurope(m){if(countryCode(m))return true;const raw=[locationText(m),m?.area,m?.country,m?.countryCode,m?.competitionGroup,m?.competitionSubgroup].filter(Boolean).join(' ');const s=norm(raw);return EUROPE_NAMES.some(name=>s.includes(norm(name)));}
function countryLabel(m){const code=countryCode(m);if(code)return COUNTRY_NAMES[code]||code;const raw=norm(locationText(m));for(const [code,name] of Object.entries(COUNTRY_NAMES)){if(raw.includes(norm(name)))return name;}return 'Ukjent land';}
// Word-boundary'd - a bare substring match (no \b) let "hallen" match inside World Athletics'
// own "Continental Tour Challenger" tier label (c-HALLEN-ger), confirmed live via a Zagreb meet's
// diagnostics: that meet's explicit source field happened to win first so it didn't change the
// outcome there, but any OTHER meet without an explicit venueType field and "Challenger" in its
// name/category would have been wrongly flagged indoor by this alone.
const INDOOR_KEYWORDS_RE=/\bindoors?\b|\bshort track\b|\bhallen\b|\bhall meeting\b|\bvelodromo\b/;
const OUTDOOR_KEYWORDS_RE=/\boutdoor\b|\bstadium\b|\bstadion\b|\bstade\b|\bsports ground\b|\bathletics track\b/;
function venueType(m){
  const explicit=String(m?.venueType||m?.environment||'').toLowerCase();
  if(explicit==='indoor'||explicit==='outdoor')return explicit;
  const s=norm([m?.name,locationText(m),m?.competitionGroup,m?.competitionSubgroup,disciplineBlob(m)].filter(Boolean).join(' '));
  if(INDOOR_KEYWORDS_RE.test(s))return'indoor';
  if(OUTDOOR_KEYWORDS_RE.test(s))return'outdoor';
  // WA calendar data almost always marks indoor meets explicitly but often omits "outdoor"
  // since it's the default case. When neither keyword is present, fall back to the European
  // indoor season (roughly desember-mars) by date rather than leaving Arena unanswered.
  const d=parseDate(m?.start)||parseDate(m?.end);
  if(d){const month=d.getMonth();return(month<=2||month===11)?'indoor':'outdoor';}
  return'outdoor';
}
function venueLabel(m){return venueType(m)==='indoor'?'Innendørs':'Utendørs';}
function isEligibleAgeMeet(m){const s=norm([m?.name,m?.competitionGroup,m?.competitionSubgroup,locationText(m)].filter(Boolean).join(' '));if(/\bu ?23\b/.test(s)||/under ?23/.test(s))return true;const underage=[/\bu ?20\b/,/\bu ?18\b/,/\bu ?17\b/,/\bu ?16\b/,/\bu ?15\b/,/\bu ?14\b/,/under ?20/,/under ?18/,/under ?17/,/under ?16/,/under ?15/,/under ?14/,/\bjunior\b/,/\byouth\b/,/\bcadet\b/,/\bcadetti\b/,/\ballievi\b/,/\besaa\b/,/\bage group\b/,/school games/,/school championships?/,/jogos escolares/,/escolares/,/\b15 a 17 anos\b/,/\b14 a 17 anos\b/,/\b16 a 19 anos\b/,/\bjuvenil\b/,/\bsub ?20\b/,/\bsub ?18\b/,/\bsub ?17\b/];return !underage.some(re=>re.test(s));}
function dedupeMeets(list){
  const map=new Map();
  for(const m of list){
    const key=[norm(m?.name),dateKey(m?.start||m?.end),countryCode(m)||norm(countryLabel(m)),String(m?.rankingCategory||'').toUpperCase()].join('|');
    if(!map.has(key)){map.set(key,m);continue;}
    const old=map.get(key);
    const oldScore=(old?.id?4:0)+(old?.hasCompetitionInformation?2:0)+(old?.hasStartlist?1:0)+((old?.disciplines||[]).length>0?1:0)+(locationText(old)?1:0);
    const newScore=(m?.id?4:0)+(m?.hasCompetitionInformation?2:0)+(m?.hasStartlist?1:0)+((m?.disciplines||[]).length>0?1:0)+(locationText(m)?1:0);
    if(newScore>oldScore)map.set(key,m);
  }
  const deduped=[...map.values()];
  // A second pass: verified fallback rows (no id, added so meet-search.js never returns a
  // false zero) can describe the same real meet under a different name than the live
  // calendar scrape ("International Combined Events Meeting Tallinn" vs "Tallinn"), so the
  // exact name+category key above misses it. If a same-date-and-country entry WITH an id
  // exists, the id-less one is redundant - drop it in favour of the real scraped one.
  const dateCountryWithId=new Set(deduped.filter(m=>m.id).map(m=>`${dateKey(m.start||m.end)}|${countryCode(m)||norm(countryLabel(m))}`));
  return deduped.filter(m=>m.id||!dateCountryWithId.has(`${dateKey(m.start||m.end)}|${countryCode(m)||norm(countryLabel(m))}`));
}
// Individual events (unlike Decathlon/Heptathlon) have no calendar category that reliably
// confirms the specific discipline is on the program. Confirmed via live diagnostics (2026-08):
// WA's calendar tags 606 of 608 real future European senior/U23 meets with only the coarse
// "Track and Field" bucket, which could contain any subset of running/jumping/throwing events -
// neither the calendar API nor a per-competition schedule/entry-list endpoint exists anywhere
// this app has access to that would confirm the real program before a meet is actually run (see
// the nimarion Swagger spec check: /competitions, /organiser and /results are the entire surface
// - no schedule/entries endpoint for future meets). Requiring eventMatches() to pass left
// individual events showing "0 stevner" even in the middle of a normal season. Showing the
// broader "Track and Field" pool instead - clearly marked per-card as unconfirmed via
// eventConfirmed() below - is more useful than an empty list, as long as it's never presented as
// if the specific event were confirmed when it wasn't.
function isGenericTrackAndFieldMeet(m){const s=disciplineBlob(m);return !!s&&s.includes('track and field');}
function eventConfirmed(m,code){if(code==='Decathlon'||code==='Heptathlon')return true;return eventMatches(m,code);}
// A national championship only awards WA ranking points to athletes representing that country -
// a Norwegian athlete can't score ranking points at, say, the German Championships. Originally
// this checked competitionGroup (confirmed populated as "Area Indoor Championships" for
// continental-level meets), assuming WA named domestic championships the same way - but a live
// diagnostic dump of the raw calendar objects for "Croatian U23 Championships"/"Swiss U23
// Championships"/"Czech Team Championships" showed competitionGroup:null for all three, so that
// field is simply not populated for domestic meets and can't be relied on alone.
// Instead this matches by name: WA names domestic (and sub-national/regional, e.g. "Lower
// Austrian Regional Championships") championships with a demonym somewhere in the name -
// not always as the very first word, so this checks for the demonym as a whole word anywhere
// in the name, not just a prefix. Multi-country events (European/World/Balkan/Nordic
// Championships etc.) never contain any of these words, so this can't false-positive on those.
const NATIONAL_DEMONYMS=[['NOR','Norwegian'],['SWE','Swedish'],['DEN','Danish'],['FIN','Finnish'],
  ['ISL','Icelandic'],['GBR','British'],['IRL','Irish'],['FRA','French'],['GER','German'],
  ['NED','Dutch'],['BEL','Belgian'],['LUX','Luxembourg'],['SUI','Swiss'],['AUT','Austrian'],
  ['ESP','Spanish'],['POR','Portuguese'],['ITA','Italian'],['GRE','Greek'],['CYP','Cypriot'],
  ['MLT','Maltese'],['POL','Polish'],['CZE','Czech'],['SVK','Slovak'],['HUN','Hungarian'],
  ['SLO','Slovenian'],['CRO','Croatian'],['BIH','Bosnian'],['SRB','Serbian'],['MNE','Montenegrin'],
  ['MKD','Macedonian'],['ALB','Albanian'],['KOS','Kosovan'],['BUL','Bulgarian'],['ROU','Romanian'],
  ['MDA','Moldovan'],['UKR','Ukrainian'],['BLR','Belarusian'],['LTU','Lithuanian'],['LAT','Latvian'],
  ['EST','Estonian'],['ARM','Armenian'],['GEO','Georgian'],['TUR','Turkish'],['AND','Andorran'],
  ['MON','Monegasque'],['LIE','Liechtenstein'],['SMR','Sammarinese'],['GIB','Gibraltarian']];
function nationalChampionshipCountryCode(m){
  const name=norm(m?.name);
  if(!name||!name.includes('championship'))return null;
  const words=name.split(' ');
  const hit=NATIONAL_DEMONYMS.find(([,demonym])=>words.includes(norm(demonym)));
  if(hit)return hit[0];
  // Fallback for the (still unconfirmed for any real domestic meet) case WA does populate
  // competitionGroup for one named this way - trust it too, using the venue's own country.
  if(norm(m?.competitionGroup||'').includes('national championship'))return countryCode(m)||null;
  return null;
}
// Multi-nation representative "Games"/"Championships" - entry is exclusively by national
// federation selection, never open registration or a direct invitation an athlete/club could act
// on. Unlike nationalChampionshipCountryCode() above (a SINGLE country's own championship, kept
// visible only for that country's own athletes), these have no "own country" case where they'd
// ever be enterable - excluded for every athlete regardless of nationality. Confirmed live: "XX
// Mediterranean Games" (Taranto, Italy) showed up under a 400m search despite being exactly this
// kind of event - no individual athlete, Norwegian or otherwise, can register for it directly.
const REPRESENTATIVE_ONLY_EVENTS=[
  'olympic games','youth olympic games',
  'world athletics championships','world championships',
  'european athletics championships','european athletics indoor championships',
  'european athletics team championships','world athletics team championships',
  'european athletics u23 championships','european athletics u20 championships','european athletics u18 championships',
  'world athletics u20 championships','world athletics u18 championships',
  'mediterranean games','european games','commonwealth games','asian games','pan american games','african games',
  'university games','world university games','universiade','military world games','island games',
  'balkan championships','nordic championships'
];
function isRepresentativeOnlyMeet(m){return hasAny(norm(m?.name),REPRESENTATIVE_ONLY_EVENTS);}
// Read directly from the shared profile store (same localStorage key athlete-profile.js writes)
// rather than wiring up another cross-script live trigger - this file only needs a fresh read
// each time it filters, not to be notified the instant the athlete changes.
function athleteCountryCode(){
  try{
    const store=JSON.parse(localStorage.getItem('rankingstevner.profile.v1')||'{}');
    const code=String(store?.waData?.country||'').toUpperCase().trim();
    return code||null;
  }catch(_){return null;}
}
// WA's calendar tags every meet with one "Discipline" category value - "Track and Field",
// "Combined Events", "Race Walking", "Cross Country", "Road Running", "Mountain Running",
// "Trail Running", etc. Only the first two belong in this app; explicit, universal gate so no
// other heuristic (event-name text match, generic-T&F fallback, verified fallback rows) can ever
// let a Race Walking/Cross Country/Road Running meet through by accident.
function isAllowedDisciplineCategory(m){const s=disciplineBlob(m);if(!s)return false;return s.includes('track and field')||s.includes('combined events');}
// The calendar's own Discipline category (checked above) can only ever say "Track and Field" -
// it has no per-event breakdown, so a meet hosting only Pole Vault matches a 100m search just as
// happily as a real sprint meet (confirmed live: "Fana stavhoppgalla", a pole-vault-only meet,
// showed up under 100m). WA's organiser "Program" data (already fetched for the "Kontakt og
// øvelser" box) DOES list the real, confirmed per-gender event names, so once it's available for
// a meet it becomes the authoritative source: only the meets it actually confirms should show.
// Real program strings confirmed live: "60m","200m sh","800m sh","60mH","60mH (0.99) U20",
// "High Jump","Shot Put (6kg) U20","4x200m sh" (relay) - "sh" is WA's "Short Track" abbreviation
// (same distance, just indoors - matches meet-history.js's SHORT_TRACK_SUFFIX_EVENTS), age/
// weight suffixes ("U20"/"(6kg)") mark a youth-category variant of the same base event.
// Deliberately does NOT strip junior age-category suffixes (U18/U20/...): both real examples
// confirmed live always list the bare/open event ALONGSIDE any age-restricted variants when both
// exist ("Shot Put" and "Shot Put (6kg) U20" as separate lines) - so requiring an exact match
// against the un-suffixed name still works for every meet actually seen, while correctly
// refusing to confirm this senior/U23-only finder's event from a U20-only (or younger) entry
// that has no bare version of its own. U23 is the one exception - this finder is explicitly
// senior/U23 scope (see isEligibleAgeMeet), so a "100m U23"-only entry (no bare "100m") should
// still confirm the event, not just literal senior entries.
function programEventBaseName(s){
  return String(s||'')
    .replace(/\([^)]*\)/g,' ')
    .replace(/\bU ?23\b/gi,' ')
    .replace(/\bsh\b/gi,' ')
    .replace(/\s+/g,' ').trim().toLowerCase();
}
const DIRECT_PROGRAM_EVENT_CODE={
  '100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m',
  '100mh':'100mH','110mh':'110mH','400mh':'400mH','3000msc':'3000mSC','3000m steeplechase':'3000mSC',
  'high jump':'HJ','pole vault':'PV','long jump':'LJ','triple jump':'TJ',
  'shot put':'SP','discus throw':'DT','discus':'DT','hammer throw':'HT','hammer':'HT','javelin throw':'JT','javelin':'JT',
  'decathlon':'Decathlon','heptathlon':'Heptathlon',
};
// Returns true (confirmed), false (program known but doesn't include this event - meet should be
// excluded), or null (no program published yet for this meet - stays with the old "unconfirmed"
// fallback treatment). Indoor sprints/hurdles substitute a genuinely shorter WA distance (60m/
// 60mH instead of 100m/100mH/110mH) - same list as meet-history.js's INDOOR_SPRINT_ALT_NAME,
// only applied when the meet itself is indoor.
function programConfirmsEvent(eventsProgram,code,sex,indoor){
  if(!Array.isArray(eventsProgram)||!eventsProgram.length)return null;
  const wantGender=sex==='W'?'women':'men';
  for(const unit of eventsProgram){
    if(String(unit?.gender||'').toLowerCase()!==wantGender)continue;
    for(const raw of (Array.isArray(unit.events)?unit.events:[])){
      const base=programEventBaseName(raw);
      if(DIRECT_PROGRAM_EVENT_CODE[base]===code)return true;
      if(indoor&&base==='60m'&&code==='100m')return true;
      if(indoor&&base==='60mh'&&(code==='100mH'||code==='110mH'))return true;
    }
  }
  return false;
}
// Keyed by `${meetId}|${eventCode}` - persisted across renders so a meet the confirmed program
// has already ruled in/out doesn't flicker back to its old unconfirmed state (or briefly
// reappear) on the next filter change/athlete switch/auto-refresh re-render.
const programMismatchKeys=new Set();
const programConfirmKeys=new Set();
function baseMatches(){
  const c=eventCode();const combined=c==='Decathlon'||c==='Heptathlon';
  const athleteCountry=athleteCountryCode();
  return dedupeMeets(allMeets.filter(m=>{
    if(!isFutureThrough2027(m)||!isEurope(m)||!isEligibleAgeMeet(m))return false;
    if(isRepresentativeOnlyMeet(m))return false;
    if(!isAllowedDisciplineCategory(m))return false;
    if(!(combined?eventMatches(m,c):(eventMatches(m,c)||isGenericTrackAndFieldMeet(m))))return false;
    // WA's own confirmed program (once fetched - see loadMeetDetails) overrides the coarse
    // Discipline-category guess above: a meet it's already ruled out for this event stays out.
    if(m.id&&programMismatchKeys.has(`${m.id}|${c}`))return false;
    // Only filter by nationality once we actually know it - with no athlete selected, or a
    // country WA's calendar didn't give a code for, showing every national championship is
    // still correct (better than silently hiding all of them on a guess).
    if(athleteCountry){
      const meetCountry=nationalChampionshipCountryCode(m);
      if(meetCountry&&meetCountry!==athleteCountry)return false;
    }
    return true;
  }));
}
function selectedFilters(){return{from:$('finderDateFrom')?.value||'',to:$('finderDateTo')?.value||'',country:$('finderCountry')?.value||'all',category:$('finderCategory')?.value||'all',venue:$('finderVenue')?.value||'all'};}
function futureMatches(){const f=selectedFilters();return baseMatches().filter(m=>{const start=parseDate(m.start)||parseDate(m.end);const end=parseDate(m.end)||start;if(f.from){const d=new Date(f.from+'T00:00:00');if(end&&end<d)return false;}if(f.to){const d=new Date(f.to+'T23:59:59');if(start&&start>d)return false;}if(f.country!=='all'&&countryLabel(m)!==f.country)return false;if(f.category!=='all'&&String(m.rankingCategory||'').toUpperCase()!==f.category)return false;if(f.venue!=='all'&&venueType(m)!==f.venue)return false;return true;}).sort((a,b)=>(parseDate(a.start)?.getTime()||0)-(parseDate(b.start)?.getTime()||0));}
// Splits the date into a short main line (day + month) and a secondary year line,
// since cramming "28. aug. 2026 – 30. aug. 2026" into a narrow facts box wraps to
// several lines. Cross-year ranges are rare enough to just spell out in full.
function dateParts(m){
  const start=parseDate(m.start),end=parseDate(m.end);
  const dayMonth=d=>new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(d);
  const yearOf=d=>String(d.getFullYear());
  if(!start&&!end)return{main:'Dato ikke publisert',year:''};
  const single=start&&end?start.toDateString()===end.toDateString():true;
  if(single){const d=start||end;return{main:dayMonth(d),year:yearOf(d)};}
  const sameYear=start.getFullYear()===end.getFullYear();
  if(sameYear&&start.getMonth()===end.getMonth()){
    const monthAbbr=dayMonth(end).replace(/^\d+\.\s*/,'');
    return{main:`${start.getDate()}.–${end.getDate()}. ${monthAbbr}`,year:yearOf(end)};
  }
  if(sameYear)return{main:`${dayMonth(start)} – ${dayMonth(end)}`,year:yearOf(end)};
  const full=d=>new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric'}).format(d);
  return{main:`${full(start)} – ${full(end)}`,year:''};
}
function dateBoxHTML(m){
  const p=dateParts(m);
  return `<strong class="meet-date">${esc(p.main)}</strong>${p.year?`<small>${esc(p.year)}</small>`:''}`;
}
function esc(v){return String(v??'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));}
function mapUrl(m){return`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText(m)||m.name||'')}`;}
function waUrl(m){return m.id?`https://worldathletics.org/competition/calendar-results/results/${encodeURIComponent(m.id)}`:WA_CALENDAR;}
// Category/discipline slugs confirmed against real worldathletics.org/records/toplists/ URLs.
const TOPLIST_SLUG={
  '100m':['sprints','100-metres'],'200m':['sprints','200-metres'],'400m':['sprints','400-metres'],
  '800m':['middlelong','800-metres'],'1500m':['middlelong','1500-metres'],'5000m':['middlelong','5000-metres'],'10000m':['middlelong','10000-metres'],'3000mSC':['middlelong','3000-metres-steeplechase'],
  '100mH':['hurdles','100-metres-hurdles'],'110mH':['hurdles','110-metres-hurdles'],'400mH':['hurdles','400-metres-hurdles'],
  'HJ':['jumps','high-jump'],'PV':['jumps','pole-vault'],'LJ':['jumps','long-jump'],'TJ':['jumps','triple-jump'],
  'SP':['throws','shot-put'],'DT':['throws','discus-throw'],'HT':['throws','hammer-throw'],'JT':['throws','javelin-throw'],
};
// Combined events need arena+sex to pick the right discipline name (see perMeetEventLabel):
// outdoor men=decathlon, outdoor women=heptathlon, indoor men=heptathlon, indoor women=pentathlon.
// Takes arena/sex explicitly (not derived from a specific meet) since this now backs a single
// shared box above the meet list instead of a per-card link - every meet in a given arena
// points at the same Toplist/Road-to page regardless of which specific competition it is.
function toplistUrlFor(code,indoor,sex){
  let category,slug;
  if(code==='Decathlon'||code==='Heptathlon'){
    category='combined-events';
    slug=indoor?(sex==='women'?'pentathlon':'heptathlon'):(sex==='women'?'heptathlon':'decathlon');
  }else if(TOPLIST_SLUG[code]){
    [category,slug]=TOPLIST_SLUG[code];
  }else{
    return null;
  }
  const year=new Date().getFullYear();
  return `https://worldathletics.org/records/toplists/${category}/${slug}/${indoor?'indoor':'outdoor'}/${sex}/senior/${year}`;
}
function stamp(){return loadedAt?new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(loadedAt):'';}
// One shared box (not per-card) covering both arenas, since the Toplist/Road-to links are the
// same for every meet in that arena - repeating them on every card was pure duplication.
function championshipStripHTML(){
  const code=eventCode(),sex=sexCode()==='W'?'women':'men';
  const section=arenaKey=>{
    const c=CHAMPIONSHIP[arenaKey];
    const indoor=arenaKey==='indoor';
    const topUrl=toplistUrlFor(code,indoor,sex);
    const topLabel=c.body==='WA'?'WA Toplist':'EA Toplist';
    const topHref=c.body==='WA'&&topUrl?topUrl:(c.body==='WA'?WA_CALENDAR:EA_TOPLIST_URL);
    const standard=c.entryStandards[code];
    // Just the number, no links - a link here would duplicate the WA/EA Toplist button below.
    // Indoor combined events lean heavily on ranking rather than a fixed standard (Apeldoorn
    // 2025: only 3 of 14 heptathlon slots went via entry standard, 11 via World/European
    // Ranking), and no Valencia 2027 standard figure could be confirmed anyway, so indoor
    // just points at Toplist instead of showing a number.
    const req=standard?`Kvalifiseringskrav: ${standard} p`:'Ingen direktekrav – kun Toplist';
    const prevSize=c.previousFieldSize?.[code];
    const places=prevSize?` · ${prevSize} plasser (som ${esc(c.previousChampionship)})`:'';
    return `<div><div style="font-weight:800">${indoor?'Innendørs':'Utendørs'} · ${esc(c.name)}</div><div class="muted" style="margin-top:4px">${req}${places}</div><div style="margin-top:6px"><a class="buttonlike" href="${esc(topHref)}" target="_blank" rel="noopener">${topLabel}</a> <a class="buttonlike" href="${esc(c.roadUrl)}" target="_blank" rel="noopener">Road to ${esc(c.name)}</a></div></div>`;
  };
  return `<div class="finder-championship" style="margin:0 0 18px;padding:16px 20px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box"><div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#007f73;margin:0 0 12px">KVALIFISERING TIL MESTERSKAP 2027</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">${section('outdoor')}${section('indoor')}</div></div>`;
}
// Applies the now-known confirmed program to the card this box belongs to: removes the "(ikke
// bekreftet)" note if the currently selected event is confirmed, or removes the whole card if
// the program is known and does NOT include it (persisted in programMismatchKeys so baseMatches()
// excludes it from scratch on the next render too, not just this one).
function applyProgramConfirmation(id,program,insightHost){
  const card=insightHost?.closest('.meet-card-v1');
  if(!card)return;
  const code=eventCode();
  const indoor=card.dataset.meetIndoor==='1';
  const result=programConfirmsEvent(program,code,sexCode(),indoor);
  const key=`${id}|${code}`;
  if(result===true){programConfirmKeys.add(key);card.querySelector('[data-event-note]')?.remove();}
  else if(result===false){programMismatchKeys.add(key);card.remove();}
}
// This finder only ever lists senior/U23 meets (see isEligibleAgeMeet's own U20/U18/U17/U16/U15/
// U14 exclusion list - U23 is always eligible, never excluded there) - WA's own program text
// still lists every age-category variant of the same event alongside the senior/open one though
// (confirmed live: "100m, ..., 100m U23, 100m U20, 100m U18, 100m U16" repeated per event), which
// is mostly noise here. Senior/open AND U23 entries are shown; only the younger junior-category
// variants (U20 and below) are dropped - same categories isEligibleAgeMeet itself excludes.
const JUNIOR_AGE_MARKER_RE=/\bU ?(?:14|15|16|17|18|20)\b/i;
function seniorProgramEvents(events){
  return (Array.isArray(events)?events:[]).filter(e=>!JUNIOR_AGE_MARKER_RE.test(String(e||'')));
}
// Only the currently selected sex's own program, not both - the box previously always showed
// "Men:"/"Women:" side by side regardless of which one the athlete/filter actually selected.
// Built fresh from the cached raw `program` array on every call (not baked into the cached HTML
// string) so it stays correct if the sex selection changes after the meet was first fetched.
function programHtmlFor(program,sex){
  const wantGender=sex==='W'?'women':'men';
  const rows=(Array.isArray(program)?program:[])
    .filter(u=>String(u?.gender||'').toLowerCase()===wantGender)
    .map(u=>({gender:u.gender,events:seniorProgramEvents(u.events)}))
    .filter(u=>u.events.length);
  return rows.length?`<div style="margin-top:8px"><span class="muted" style="font-size:11px">Program</span>${rows.map(u=>`<div style="margin-top:2px"><strong style="font-size:12px">${esc(u.gender)}:</strong> <span style="font-size:12px">${esc(u.events.join(', '))}</span></div>`).join('')}</div>`:'';
}
async function loadMeetDetails(id,insightHost){
  if(meetDetailsCache.has(id)){
    const cached=meetDetailsCache.get(id);
    try{
      if(insightHost)insightHost.innerHTML=cached.contactHtml+programHtmlFor(cached.program,sexCode());
      applyProgramConfirmation(id,cached.program,insightHost);
    }catch(e){
      console.error('Kunne ikke gjenbruke mellomlagrede stevnedetaljer for id',id,e);
      if(insightHost)insightHost.innerHTML=`<span>Kontakt og øvelser</span><strong class="muted">Ikke bekreftet</strong>`;
    }
    return;
  }
  try{
    // Per-request cache-buster, not just cache:'no-store': that flag only skips the browser's
    // own cache, not Cloudflare's edge cache, which the response's own 1h s-maxage still allows -
    // a fixed URL like this one is exactly what caused the earlier total-outage stale-cache bug.
    const r=await fetch(`/api/meet-details?id=${encodeURIComponent(id)}&t=${Date.now()}`,{cache:'no-store'});
    const d=await r.json();
    if(!d.ok)throw new Error(d.error||'Kunne ikke hente detaljer');
    const x=d.details||{};
    // WA often lists the same contact person 2-3 times (identical name+email) - dedupe before
    // rendering, and drop the "role" field (rarely useful) to keep this to one compact line.
    const contacts=Array.isArray(x.contactPersons)?x.contactPersons:[];
    const uniqueContacts=[...new Map(contacts.map(c=>[[c.name,c.email].join('|'),c])).values()];
    const contactText=uniqueContacts.length
      ?uniqueContacts.map(c=>esc([c.name,c.email,c.phone].filter(Boolean).join(' · '))).join(' ; ')
      :'Ingen kontaktperson oppgitt.';
    const prizeEntries=x.prizeMoney?Object.entries(x.prizeMoney).filter(([,v])=>v):[];
    const prizeLabel=prizeEntries.length?`Premier: ${prizeEntries.map(([k,v])=>`${k}: ${v}`).join(', ')}`:'';
    // WA's organiser payload is inconsistent about what shape these URLs come in:
    //  - a path starting with "/" (e.g. "/competition/.../results/123") IS relative to
    //    worldathletics.org - WA hosts results for meets worldwide, so resultsUrl commonly
    //    looks like this. Resolving it against *our* page instead silently linked back into
    //    this app.
    //  - a bare host with no scheme (e.g. "sul.fi" for a Finnish federation's own site) is
    //    the organiser's OWN external domain, not a WA path - resolving THAT against
    //    worldathletics.org built the nonsensical worldathletics.org/sul.fi.
    //  - the literal string "404" (or a full https://worldathletics.org/404 URL) is WA's
    //    own placeholder for "not available", not a real link.
    //  - some fields carry the URL plus a trailing note in the same string, e.g.
    //    "www.ruotsiottelu.fi (only fin and swe athletes)" - the raw space made the whole
    //    note part of the "hostname", so the browser tried to resolve that as one domain
    //    and failed (DNS_PROBE_FINISHED_NXDOMAIN). Keep only the first token as the URL and
    //    surface the rest as plain text instead of silently dropping it.
    // Final safety net: WA's organiser data has already produced several distinct kinds of
    // garbage (a bare "404" sentinel, a note glued onto the URL, a relative path). Rather than
    // reacting to each new shape one bug report at a time, reject anything that doesn't
    // resolve to a plausible real hostname - catches shapes not seen yet too, so a broken
    // link fails closed (hidden) instead of shipping and waiting to be manually caught.
    const VALID_HOST=/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
    const abs=u=>{
      if(!u)return null;
      const raw=String(u).trim();
      if(!raw||/^\d+$/.test(raw))return null;
      const [s,...rest]=raw.split(/\s+/);
      const note=rest.join(' ');
      try{
        const parsed=/^https?:\/\//i.test(s)||s.startsWith('/')
          ?new URL(s,'https://worldathletics.org/')
          :new URL(`https://${s}`);
        if(parsed.pathname==='/404'||!VALID_HOST.test(parsed.hostname))return null;
        return {href:parsed.href,note};
      }catch(_){return null;}
    };
    // WA's own "i" popup on their calendar only shows a "Website:"/"Results:" line when the
    // organiser actually published one (confirmed live: some meets show both, some show only
    // "Results:", most show neither) - it never fabricates a link to WA's own competition page
    // as a substitute. Nettside/Resultater now match that: hidden, not backfilled, when empty.
    // Premier still links out to WA's own page when there IS prize info to show, since the
    // prize text itself has no dedicated URL of its own in the organiser data.
    const fallbackUrl=waUrl({id});
    // Returns {anchor, note} instead of a ready HTML string - a trailing note (e.g. "(only fin
    // and swe athletes)") used to sit inline right after its link, and once it wrapped to its
    // own line it left the following " · Label" separator orphaned at the start of a line.
    // Anchors now join into one clean row and every note renders on its own line below instead.
    const linkParts=(label,u,fallback)=>{
      const r=abs(u)||(fallback?{href:fallback,note:''}:null);
      return r?{anchor:`<a href="${esc(r.href)}" target="_blank" rel="noopener">${label}</a>`,note:r.note}:null;
    };
    const items=[
      linkParts('Nettside',x.websiteUrl), // no fallback - only shown when WA actually has one
      linkParts('Resultater',x.resultsUrl), // no fallback - only shown when WA actually has one
      // Only shown when WA's organiser data actually has prize money published - previously this
      // always showed a bare "Premier" link (to WA's own page) even with nothing to report.
      prizeLabel?{anchor:`<a href="${esc(fallbackUrl)}" target="_blank" rel="noopener">${esc(prizeLabel)}</a>`,note:''}:null,
      linkParts('Livestream',x.liveStreamUrl), // no fallback - only shown when WA actually has one
    ].filter(Boolean);
    // Each "· anchor" pair is kept in one nowrap span so a line break can never strand the
    // bullet alone at the start of the next line.
    // Explicit font-size on every item, not just the "· "-prefixed ones: the ambient
    // .meet-insight span{font-size:11px} rule (meant for the small label spans elsewhere in
    // this box) was leaking into the nowrap wrapper spans below, shrinking every link except
    // the unwrapped first one and making them look mismatched.
    // A flex row with gap packs the four links noticeably tighter than plain text-flow with
    // literal space characters between them, giving the best chance all four sit on one line.
    const linkRow=items.map((it,i)=>`<span style="white-space:nowrap;font-size:13px">${i===0?'':'· '}${it.anchor}</span>`).join('');
    const notesHtml=items.filter(it=>it.note).map(it=>`<div class="muted" style="margin-top:2px">${esc(it.note)}</div>`).join('');
    const linksHtml=items.length?`<div style="margin-top:4px;display:flex;flex-wrap:wrap;column-gap:8px;row-gap:2px">${linkRow}</div>${notesHtml}`:'';
    const infoHtml=x.additionalInfo?`<div style="margin-top:4px">${esc(x.additionalInfo)}</div>`:'';
    // Only present when WA's organiser has actually published a program for this meet - most
    // meets this far out haven't, so this stays empty far more often than not.
    const program=Array.isArray(x.eventsProgram)?x.eventsProgram:[];
    const contactHtml=`<span>Kontakt og øvelser</span><strong>${contactText}</strong>${linksHtml}${infoHtml}`;
    meetDetailsCache.set(id,{contactHtml,program});
    if(insightHost)insightHost.innerHTML=contactHtml+programHtmlFor(program,sexCode());
    applyProgramConfirmation(id,program,insightHost);
    // Confirmed via WA's /organiser payload: it carries contact/prize/link info only, no
    // venue/stadium/address field, so the map link stays on the calendar's city-level text
    // set at render time (mapUrl(m)) - there's nothing more precise to upgrade it to here.
  }catch(e){
    // A 404 here means WA hasn't published this meet's organiser/contact page yet - normal
    // for a meet many months out, not a technical failure - so show that instead of leaking
    // the raw "WA-kilde 404" backend error string to the user.
    const notYet=/^WA-kilde 404$/.test(e.message||'');
    const msg=notYet?'Kontaktinfo er ikke publisert av arrangøren ennå.':'Ikke bekreftet';
    if(!notYet)console.error('Kunne ikke hente stevnedetaljer for id',id,e);
    if(insightHost)insightHost.innerHTML=`<span>Kontakt og øvelser</span><strong class="muted">${esc(msg)}</strong>`;
  }
}
function loadAllMeetDetails(host){
  host.querySelectorAll('[data-meet-contact]').forEach(insightHost=>{
    loadMeetDetails(insightHost.dataset.meetContact,insightHost);
  });
}
function resetFilterInputs(){const today=new Date().toISOString().slice(0,10);const from=document.getElementById('finderDateFrom');if(from)from.value=today;const to=document.getElementById('finderDateTo');if(to)to.value='2027-12-31';const country=document.getElementById('finderCountry');if(country)country.value='all';const category=document.getElementById('finderCategory');if(category)category.value='all';const venue=document.getElementById('finderVenue');if(venue)venue.value='all';}
function filterBar(){const base=baseMatches();const countries=[...new Set(base.map(countryLabel).filter(x=>x&&x!=='Ukjent land'))].sort((a,b)=>a.localeCompare(b,'nb'));const cats=RANKING_CATEGORIES;const prev=selectedFilters();const today=new Date().toISOString().slice(0,10);return `<div class="finder-filterbar" style="margin:0 0 18px;padding:16px 20px 18px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box;height:100%"><div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 12px"><span style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#007f73">FILTRER STEVNER</span><button type="button" id="finderResetFilters" class="secondary" style="padding:4px 12px;font-size:12px;border-radius:8px">Nullstill</button></div><div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px"><label style="font-size:12px;font-weight:700">Fra dato<input id="finderDateFrom" type="date" value="${esc(prev.from||today)}" min="${today}" max="2027-12-31" style="width:100%;margin-top:6px"></label><label style="font-size:12px;font-weight:700">Til dato<input id="finderDateTo" type="date" value="${esc(prev.to||'2027-12-31')}" min="${today}" max="2027-12-31" style="width:100%;margin-top:6px"></label><label style="font-size:12px;font-weight:700">Land<select id="finderCountry" style="width:100%;margin-top:6px"><option value="all">Alle land</option>${countries.map(x=>`<option${prev.country===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label><label style="font-size:12px;font-weight:700">Stevnekategori<select id="finderCategory" style="width:100%;margin-top:6px"><option value="all">Alle kategorier</option>${cats.map(x=>`<option${prev.category===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label><label style="font-size:12px;font-weight:700">Arena<select id="finderVenue" style="width:100%;margin-top:6px"><option value="all"${prev.venue==='all'?' selected':''}>Alle</option><option value="outdoor"${prev.venue==='outdoor'?' selected':''}>Utendørs</option><option value="indoor"${prev.venue==='indoor'?' selected':''}>Innendørs</option></select></label></div></div>`;}
function bindFilters(){['finderDateFrom','finderDateTo','finderCountry','finderCategory','finderVenue'].forEach(id=>$(id)?.addEventListener('change',render));$('finderResetFilters')?.addEventListener('click',()=>{resetFilterInputs();render();});}
function render(){const host=$('meetList');if(!host)return;const base=baseMatches();const matches=futureMatches();const code=eventCode();const combined=code==='Decathlon'||code==='Heptathlon';const combinedNote=combined?' For fremtidige mangekampstevner brukes også WA-betegnelsen «Combined Events» når detaljprogrammet ikke er publisert.':'';
  // See eventConfirmed()/isGenericTrackAndFieldMeet() above: for individual events this list
  // includes meets whose specific program isn't confirmed yet, so the summary text says so up
  // front rather than only on the per-card badge, which someone skimming just the count could miss.
  const individualNote=combined?'':' Programmet er ofte ikke offentliggjort ennå - stevner der øvelsen ikke er bekreftet er merket «ikke bekreftet», sjekk stevnets eget program.';
  const summary=`<div class="finder-summary"><div><span class="eyebrow">FREMTIDIGE WA-STEVNER</span><h4>${esc(eventLabel())}</h4><p class="muted">Kun senior- og U23-stevner i Europa.${combinedNote}${individualNote}${loadedAt?` Sist oppdatert ${stamp()}.`:''}</p></div><div class="finder-count">${loading?'…':matches.length}<small>${loading?'henter':'aktuelle stevner'}</small></div></div>`;if(loading&&!allMeets.length){host.innerHTML=summary+`<div class="finder-empty"><strong>Henter fremtidige stevner…</strong></div>`;return;}if(loadError&&!allMeets.length){host.innerHTML=summary+`<div class="finder-empty"><strong>Kunne ikke hente stevnekalenderen.</strong><p class="muted">${esc(loadError)}</p></div>`;return;}const controls=filterBar()+championshipStripHTML()+'<div id="rankingRecommendations"></div>';if(!matches.length){const emptyBody=base.length?`<strong>Ingen treff med valgte filtre.</strong><p class="muted">Prøv å utvide dato eller velge Alle i filtrene.</p>`:`<strong>Fant ingen ${esc(eventLabel())}-stevner i den offentlige WA-kalenderen akkurat nå.</strong><p class="muted">Kan skyldes en reell pause i terminlisten, eller at færre stevner har publisert fullt program denne langt frem i tid.</p>`;host.innerHTML=summary+controls+`<div class="finder-empty">${emptyBody}</div>`;bindFilters();window.dispatchEvent(new CustomEvent('meetlistrendered'));return;}host.innerHTML=summary+controls+matches.map(m=>{const confirmed=eventConfirmed(m,code)||(m.id&&programConfirmKeys.has(`${m.id}|${code}`));const eventNote=confirmed?'':' <span class="muted" data-event-note style="font-weight:400;font-size:11px">(ikke bekreftet)</span>';return `<article class="meet-card meet-card-v1" data-meet-id="${esc(m.id||'')}" data-meet-start="${esc(m.start||'')}" data-meet-indoor="${venueType(m)==='indoor'?'1':'0'}"><div class="meet-top"><div><h4>${esc(m.name||'Stevne')}</h4><div class="meta">${esc(locationText(m)||'Sted ikke publisert')} <a href="${esc(mapUrl(m))}" target="_blank" rel="noopener">Vis i kart</a></div></div><span class="cat">${esc(m.rankingCategory||'WA')}</span></div><div class="meet-facts"><div><span>Dato</span>${dateBoxHTML(m)}</div><div><span>Land</span><strong>${esc(countryLabel(m))}</strong></div><div><span>Øvelse</span><strong>${esc(perMeetEventLabel(m))}${eventNote}</strong></div><div><span>Arena</span><strong>${esc(venueLabel(m))}</strong></div></div><div class="meet-insight"><span>Historisk nivå</span><strong>Historiske resultater kobles inn senere.</strong></div>${m.id?`<div class="meet-insight" data-meet-contact="${esc(m.id)}"><span>Kontakt og øvelser</span><strong class="muted">Henter kontaktinfo og program …</strong></div>`:''}</article>`;}).join('');bindFilters();loadAllMeetDetails(host);window.dispatchEvent(new CustomEvent('meetlistrendered'));}
async function load(){if(loading)return;loading=true;loadError='';render();try{const params=new URLSearchParams({v:'58',event:eventCode(),startDate:new Date().toISOString().slice(0,10),endDate:'2027-12-31'});const res=await fetch(`/api/meet-search?${params}`,{cache:'no-store'});const data=await res.json();if(!res.ok||!data?.ok)throw new Error(data?.error||`Kalenderkilde svarte ${res.status}`);allMeets=Array.isArray(data.results)?data.results:[];loadedAt=new Date();}catch(e){loadError=String(e?.message||e);}finally{loading=false;render();}}
function install(){const panel=$('meetList')?.closest('.panel');if(panel){const h=panel.querySelector('h3');if(h)h.textContent='Finn aktuelle rankingstevner';const status=panel.querySelector('.section-head>.muted');if(status)status.textContent='World Athletics-kalender';}$('meetCategoryFilter')?.closest('.filters')?.setAttribute('style','display:none!important');$('event')?.addEventListener('change',()=>setTimeout(load,0));$('sex')?.addEventListener('change',()=>{resetFilterInputs();setTimeout(load,0);});
  // The national-championship filter depends on which athlete is selected, not just event/sex -
  // without this, switching to a different athlete wouldn't re-apply it until event or sex also
  // happened to change. render() alone (no new fetch) is enough since baseMatches() re-reads the
  // athlete's country fresh every time it runs.
  const waStatus=$('waProfileStatus');
  if(waStatus)new MutationObserver(()=>render()).observe(waStatus,{childList:true,subtree:true,characterData:true});
  load();setInterval(load,15*60*1000);
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
// Lets the "Anbefalte stevner" box reuse the exact same event/sex/eligibility/program-confirmation
// filtering this file already does, instead of a second, potentially-inconsistent reimplementation.
window.RankingstevnerMeetFinder={currentMatches:baseMatches};
})();