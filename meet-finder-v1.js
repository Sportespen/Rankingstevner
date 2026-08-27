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
  },
};
// EA has no confirmed per-event deep-link pattern (unlike WA's toplists path), so the EA
// Toplist button goes to their general Top Lists page rather than a guessed filtered URL.
const EA_TOPLIST_URL='https://www.european-athletics.com/home/historical-data/top-lists';
const MAX_DATE=new Date('2027-12-31T23:59:59');
let allMeets=[];let loading=false;let loadError='';let loadedAt=null;
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
function venueType(m){
  const explicit=String(m?.venueType||m?.environment||'').toLowerCase();
  if(explicit==='indoor'||explicit==='outdoor')return explicit;
  const s=norm([m?.name,locationText(m),m?.competitionGroup,m?.competitionSubgroup,disciplineBlob(m)].filter(Boolean).join(' '));
  if(/indoor|short track|indoors|hallen|hall meeting|velodromo/.test(s))return'indoor';
  if(/outdoor|stadium|stadion|stade|sports ground|athletics track/.test(s))return'outdoor';
  // WA calendar data almost always marks indoor meets explicitly but often omits "outdoor"
  // since it's the default case. When neither keyword is present, fall back to the European
  // indoor season (roughly desember-mars) by date rather than leaving Arena unanswered.
  const d=parseDate(m?.start)||parseDate(m?.end);
  if(d){const month=d.getMonth();return(month<=2||month===11)?'indoor':'outdoor';}
  return'outdoor';
}
function venueLabel(m){return venueType(m)==='indoor'?'Innendørs':'Utendørs';}
function isEligibleAgeMeet(m){const s=norm([m?.name,m?.competitionGroup,m?.competitionSubgroup,locationText(m)].filter(Boolean).join(' '));if(/\bu ?23\b/.test(s)||/under ?23/.test(s))return true;const underage=[/\bu ?20\b/,/\bu ?18\b/,/\bu ?17\b/,/\bu ?16\b/,/\bu ?15\b/,/\bu ?14\b/,/under ?20/,/under ?18/,/under ?17/,/under ?16/,/under ?15/,/under ?14/,/\bjunior\b/,/\byouth\b/,/\bcadet\b/,/\bage group\b/,/school games/,/school championships?/,/jogos escolares/,/escolares/,/\b15 a 17 anos\b/,/\b14 a 17 anos\b/,/\b16 a 19 anos\b/,/\bjuvenil\b/,/\bsub ?20\b/,/\bsub ?18\b/,/\bsub ?17\b/];return !underage.some(re=>re.test(s));}
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
function baseMatches(){const c=eventCode();return dedupeMeets(allMeets.filter(m=>isFutureThrough2027(m)&&eventMatches(m,c)&&isEurope(m)&&isEligibleAgeMeet(m)));}
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
function waTopListUrl(m){
  const code=eventCode(),indoor=venueType(m)==='indoor',sex=sexCode()==='W'?'women':'men';
  let category,slug;
  if(code==='Decathlon'||code==='Heptathlon'){
    category='combined-events';
    slug=indoor?(sex==='women'?'pentathlon':'heptathlon'):(sex==='women'?'heptathlon':'decathlon');
  }else if(TOPLIST_SLUG[code]){
    [category,slug]=TOPLIST_SLUG[code];
  }else{
    return waUrl(m);
  }
  const year=(parseDate(m.start)||new Date()).getFullYear();
  return `https://worldathletics.org/records/toplists/${category}/${slug}/${indoor?'indoor':'outdoor'}/${sex}/senior/${year}`;
}
// Which federation's Toplist to link to also depends on arena, via CHAMPIONSHIP[venueType].body -
// same source of truth as the championship button, so the two stay in sync if that config changes.
function toplistButtonHTML(m){
  const isWA=championshipFor(m).body==='WA';
  return `<a class="buttonlike" href="${esc(isWA?waTopListUrl(m):EA_TOPLIST_URL)}" target="_blank" rel="noopener">${isWA?'WA Toplist':'EA Toplist'}</a>`;
}
function stamp(){return loadedAt?new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(loadedAt):'';}
function championshipFor(m){return CHAMPIONSHIP[venueType(m)]||CHAMPIONSHIP.outdoor;}
function championshipButtonHTML(m){const c=championshipFor(m);return `<a class="buttonlike" href="${esc(c.roadUrl)}" target="_blank" rel="noopener">Road to ${esc(c.name)}</a>`;}
function roadBoxHTML(m){
  const c=championshipFor(m);
  const code=eventCode();
  const standard=c.entryStandards[code];
  const rankingUrl=c.rankingUrl[code];
  const body=standard
    ?`<strong>Kvalifiseringskrav: ${standard} p</strong>${rankingUrl?`<div style="margin-top:4px"><a href="${esc(rankingUrl)}" target="_blank" rel="noopener">Se offisiell ranking</a></div>`:''}`
    :`<strong class="muted">Se offisielle krav hos arrangøren.</strong><div style="margin-top:4px"><a href="${esc(c.qualificationUrl)}" target="_blank" rel="noopener">${esc(c.name)}</a></div>`;
  return `<div class="meet-insight road"><span>Road to ${esc(c.name)}</span>${body}</div>`;
}
async function loadMeetDetails(id,insightHost){
  try{
    const r=await fetch(`/api/meet-details?id=${encodeURIComponent(id)}`,{cache:'no-store'});
    const d=await r.json();
    if(!d.ok)throw new Error(d.error||'Kunne ikke hente detaljer');
    const x=d.details||{};
    const contacts=Array.isArray(x.contactPersons)?x.contactPersons:[];
    const contactText=contacts.length?contacts.map(c=>esc([c.name,c.role,c.email,c.phone].filter(Boolean).join(' · '))).join('<br>'):'Ingen kontaktperson oppgitt i WA.';
    const prizes=x.prizeMoney&&Object.keys(x.prizeMoney).length?esc(JSON.stringify(x.prizeMoney)):'Ikke oppgitt';
    // WA's organiser payload sometimes gives a path relative to worldathletics.org
    // (e.g. "/competition/.../results/123") rather than a full URL. Rendered as-is that
    // resolves against *our* page instead and silently links back into this app.
    // WA's organiser API sometimes returns the literal string "404" for a missing
    // website/results/livestream URL instead of omitting the field or returning null -
    // resolved as a relative path that innocently builds https://worldathletics.org/404.
    const abs=u=>{
      if(!u||/^\d+$/.test(String(u).trim()))return'';
      try{
        const parsed=new URL(u,'https://worldathletics.org/');
        // Reject WA's "not available" placeholder itself, whether it arrived as the bare
        // string "404" (resolves to this path) or already as a full worldathletics.org/404 URL.
        if(parsed.pathname==='/404')return'';
        return parsed.href;
      }catch(_){return'';}
    };
    const links=[
      abs(x.websiteUrl)?`<a href="${esc(abs(x.websiteUrl))}" target="_blank" rel="noopener">Stevnets nettside</a>`:'',
      abs(x.resultsUrl)?`<a href="${esc(abs(x.resultsUrl))}" target="_blank" rel="noopener">Resultater</a>`:'',
      abs(x.liveStreamUrl)?`<a href="${esc(abs(x.liveStreamUrl))}" target="_blank" rel="noopener">Livestream</a>`:'',
    ].filter(Boolean).join(' · ');
    const linksHtml=links?`<div style="margin-top:4px">${links}</div>`:'';
    const infoHtml=x.additionalInfo?`<div style="margin-top:4px">${esc(x.additionalInfo)}</div>`:'';
    if(insightHost)insightHost.innerHTML=`<span>Kontakt og premier</span><strong>${contactText}</strong><small>Premier: ${prizes}</small>${linksHtml}${infoHtml}`;
    // Confirmed via WA's /organiser payload: it carries contact/prize/link info only, no
    // venue/stadium/address field, so the map link stays on the calendar's city-level text
    // set at render time (mapUrl(m)) - there's nothing more precise to upgrade it to here.
  }catch(e){
    if(insightHost)insightHost.innerHTML=`<span>Kontakt og premier</span><strong class="muted">${esc(e.message)}</strong>`;
  }
}
function loadAllMeetDetails(host){
  host.querySelectorAll('[data-meet-contact]').forEach(insightHost=>{
    loadMeetDetails(insightHost.dataset.meetContact,insightHost);
  });
}
function filterBar(){const base=baseMatches();const countries=[...new Set(base.map(countryLabel).filter(x=>x&&x!=='Ukjent land'))].sort((a,b)=>a.localeCompare(b,'nb'));const cats=RANKING_CATEGORIES;const prev=selectedFilters();const today=new Date().toISOString().slice(0,10);return `<div class="finder-filterbar" style="margin:0 0 18px;padding:16px 20px 18px;border:1px solid #cfe2dc;border-radius:14px;background:#f5fbf9;box-sizing:border-box;height:100%"><div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#007f73;margin:0 0 12px">FILTRER STEVNER</div><div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px"><label style="font-size:12px;font-weight:700">Fra dato<input id="finderDateFrom" type="date" value="${esc(prev.from||today)}" min="${today}" max="2027-12-31" style="width:100%;margin-top:6px"></label><label style="font-size:12px;font-weight:700">Til dato<input id="finderDateTo" type="date" value="${esc(prev.to||'2027-12-31')}" min="${today}" max="2027-12-31" style="width:100%;margin-top:6px"></label><label style="font-size:12px;font-weight:700">Land<select id="finderCountry" style="width:100%;margin-top:6px"><option value="all">Alle land</option>${countries.map(x=>`<option${prev.country===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label><label style="font-size:12px;font-weight:700">Stevnekategori<select id="finderCategory" style="width:100%;margin-top:6px"><option value="all">Alle kategorier</option>${cats.map(x=>`<option${prev.category===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label><label style="font-size:12px;font-weight:700">Arena<select id="finderVenue" style="width:100%;margin-top:6px"><option value="all"${prev.venue==='all'?' selected':''}>Alle</option><option value="outdoor"${prev.venue==='outdoor'?' selected':''}>Utendørs</option><option value="indoor"${prev.venue==='indoor'?' selected':''}>Innendørs</option></select></label></div></div>`;}
function bindFilters(){['finderDateFrom','finderDateTo','finderCountry','finderCategory','finderVenue'].forEach(id=>$(id)?.addEventListener('change',render));}
function render(){const host=$('meetList');if(!host)return;const matches=futureMatches();const combinedNote=['Decathlon','Heptathlon'].includes(eventCode())?' For fremtidige mangekampstevner brukes også WA-betegnelsen «Combined Events» når detaljprogrammet ikke er publisert.':'';const summary=`<div class="finder-summary"><div><span class="eyebrow">FREMTIDIGE WA-STEVNER</span><h4>${esc(eventLabel())}</h4><p class="muted">Kun senior- og U23-stevner i Europa.${combinedNote}${loadedAt?` Sist oppdatert ${stamp()}.`:''}</p></div><div class="finder-count">${loading?'…':matches.length}<small>${loading?'henter':'aktuelle stevner'}</small></div></div>`;if(loading&&!allMeets.length){host.innerHTML=summary+`<div class="finder-empty"><strong>Henter fremtidige stevner…</strong></div>`;return;}if(loadError&&!allMeets.length){host.innerHTML=summary+`<div class="finder-empty"><strong>Kunne ikke hente stevnekalenderen.</strong><p class="muted">${esc(loadError)}</p></div>`;return;}const controls=filterBar();if(!matches.length){host.innerHTML=summary+controls+`<div class="finder-empty"><strong>Ingen treff med valgte filtre.</strong><p class="muted">Prøv å utvide dato eller velge Alle i filtrene.</p></div>`;bindFilters();return;}host.innerHTML=summary+controls+matches.map(m=>`<article class="meet-card meet-card-v1"><div class="meet-top"><div><h4>${esc(m.name||'Stevne')}</h4><div class="meta">${esc(locationText(m)||'Sted ikke publisert')}</div></div><span class="cat">${esc(m.rankingCategory||'WA')}</span></div><div class="meet-facts"><div><span>Dato</span>${dateBoxHTML(m)}</div><div><span>Land</span><strong>${esc(countryLabel(m))}</strong></div><div><span>Øvelse</span><strong>${esc(perMeetEventLabel(m))}</strong></div><div><span>Arena</span><strong>${esc(venueLabel(m))}</strong></div></div><div class="meet-insight"><span>Historisk nivå</span><strong>Historiske resultater kobles inn senere.</strong></div>${roadBoxHTML(m)}${m.id?`<div class="meet-insight" data-meet-contact="${esc(m.id)}"><span>Kontakt og premier</span><strong class="muted">Henter kontakt- og premieinfo …</strong></div>`:''}<div class="card-actions"><a class="buttonlike" href="${mapUrl(m)}" target="_blank" rel="noopener">Vis i kart</a>${toplistButtonHTML(m)}${championshipButtonHTML(m)}</div></article>`).join('');bindFilters();loadAllMeetDetails(host);}
async function load(){if(loading)return;loading=true;loadError='';render();try{const params=new URLSearchParams({v:'58',event:eventCode(),startDate:new Date().toISOString().slice(0,10),endDate:'2027-12-31'});const res=await fetch(`/api/meet-search?${params}`,{cache:'no-store'});const data=await res.json();if(!res.ok||!data?.ok)throw new Error(data?.error||`Kalenderkilde svarte ${res.status}`);allMeets=Array.isArray(data.results)?data.results:[];loadedAt=new Date();}catch(e){loadError=String(e?.message||e);}finally{loading=false;render();}}
function install(){const panel=$('meetList')?.closest('.panel');if(panel){const h=panel.querySelector('h3');if(h)h.textContent='Finn aktuelle rankingstevner';const status=panel.querySelector('.section-head>.muted');if(status)status.textContent='World Athletics-kalender';}$('meetCategoryFilter')?.closest('.filters')?.setAttribute('style','display:none!important');$('event')?.addEventListener('change',()=>setTimeout(load,0));$('sex')?.addEventListener('change',()=>setTimeout(load,0));load();setInterval(load,15*60*1000);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();