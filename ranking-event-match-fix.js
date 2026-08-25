// Rankingstevner v0.19.1 – robust kobling mellom valgte øvelser og WA world ranking event groups
(() => {
  'use strict';

  const STORE_KEY='rankingstevner.profile.v1';

  function canonicalSelected(code){
    const map={
      '100m':'100m','200m':'200m','400m':'400m','800m':'800m','1500m':'1500m','5000m':'5000m','10000m':'10000m',
      '100mH':'100mh','110mH':'110mh','400mH':'400mh','3000mSC':'3000msc',
      'HJ':'hj','PV':'pv','LJ':'lj','TJ':'tj','SP':'sp','DT':'dt','HT':'ht','JT':'jt',
      'Decathlon':'decathlon','Heptathlon':'heptathlon'
    };
    return map[code]||'';
  }

  function canonicalWaEvent(raw){
    let s=String(raw||'').toLowerCase();
    s=s.replace(/[’']/g,"'")
      .replace(/^\s*(women'?s|woman'?s|men'?s)\s+/,'')
      .replace(/metres?|meters?/g,'m')
      .replace(/\s+/g,' ')
      .trim();

    if(/decathlon/.test(s)) return 'decathlon';
    if(/heptathlon/.test(s) && !/short track/.test(s)) return 'heptathlon';
    if(/high jump/.test(s)) return 'hj';
    if(/pole vault/.test(s)) return 'pv';
    if(/long jump/.test(s)) return 'lj';
    if(/triple jump/.test(s)) return 'tj';
    if(/shot put/.test(s)) return 'sp';
    if(/discus/.test(s)) return 'dt';
    if(/hammer/.test(s)) return 'ht';
    if(/javelin/.test(s)) return 'jt';
    if(/3000\s*m.*(steeple|obstacle)/.test(s) || /3000msc/.test(s.replace(/[^a-z0-9]/g,''))) return '3000msc';
    if(/100\s*m.*hurdle/.test(s)) return '100mh';
    if(/110\s*m.*hurdle/.test(s)) return '110mh';
    if(/400\s*m.*hurdle/.test(s)) return '400mh';

    const compact=s.replace(/[^a-z0-9]/g,'');
    for(const d of ['10000','5000','1500','800','400','200','100']){
      if(compact===`${d}m` || compact.startsWith(`${d}m`)) return `${d}m`;
    }
    return compact;
  }

  function readData(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')?.waData||null;}catch(_){return null;}
  }

  function patchRankingHeader(){
    const event=document.getElementById('event');
    const details=document.getElementById('waProfileDetails');
    if(!event||!details) return;

    const data=readData();
    if(!data||!Array.isArray(data.rankings)) return;

    const wanted=canonicalSelected(event.value);
    if(!wanted) return;
    const rank=(data.rankings||[]).find(r=>canonicalWaEvent(r?.event)===wanted);
    const score=(data.rankingScores||[]).find(r=>canonicalWaEvent(r?.event)===wanted);
    const label=event.options[event.selectedIndex]?.textContent||event.value;

    let header=[...details.children].find(el=>el.id!=='autoRankingBasisAllEvents' && !el.closest?.('#autoRankingBasisAllEvents'));
    if(!header){
      header=document.createElement('div');
      details.insertBefore(header,details.firstChild||null);
    }

    const html=rank
      ? `<strong>Rankinggrunnlag for ${label}:</strong><br>#${Number(rank.rank)} ${rank.event}${score?.score?` · <strong>${score.score} Ranking Score</strong>`:''}`
      : `<strong>Rankinggrunnlag for ${label}:</strong><br>Ingen gjeldende WA-ranking funnet for denne øvelsen.`;

    if(header.innerHTML!==html) header.innerHTML=html;
    details.style.display='block';
  }

  function boot(){
    const event=document.getElementById('event');
    const sex=document.getElementById('sex');
    const details=document.getElementById('waProfileDetails');
    if(!event||!details){setTimeout(boot,100);return;}

    let queued=false;
    const schedule=()=>{
      if(queued)return;
      queued=true;
      setTimeout(()=>{queued=false;patchRankingHeader();},30);
    };

    event.addEventListener('change',()=>setTimeout(schedule,100));
    sex?.addEventListener('change',()=>setTimeout(schedule,120));
    new MutationObserver(schedule).observe(details,{childList:true,subtree:true,characterData:true});
    window.addEventListener('storage',schedule);
    setTimeout(schedule,300);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
