// Stevnefinner v1 – presentation structure before live data sources are connected.
(() => {
'use strict';
const eventLabel=()=>document.getElementById('event')?.selectedOptions?.[0]?.textContent||'valgt øvelse';
const meetData=[
 {name:'Hypo-Meeting Götzis',place:'Götzis, Østerrike',country:'AUT',cat:'GL',events:['Decathlon','Heptathlon'],date:'Mai 2027',contact:'Arrangørkontakt kobles inn',prize:'Premiepenger kobles inn',history:'Historisk nivå kobles til tidligere resultatlister',road:'Road to neste mesterskap kobles inn'},
 {name:'Decastar Talence',place:'Talence, Frankrike',country:'FRA',cat:'GL',events:['Decathlon','Heptathlon'],date:'2027 – dato kommer',contact:'Arrangørkontakt kobles inn',prize:'Premiepenger kobles inn',history:'Historisk nivå kobles til tidligere resultatlister',road:'Road to neste mesterskap kobles inn'},
 {name:'Bislett Games',place:'Oslo, Norge',country:'NOR',cat:'GW',events:['100m','200m','400m','800m','1500m','5000m','100mH','110mH','400mH','HJ','PV','LJ','TJ','SP','DT','JT'],date:'2027 – dato kommer',contact:'Invitasjonsstevne – kontakt kobles inn',prize:'Premiepenger kobles inn',history:'Historisk nivå kobles til tidligere resultatlister',road:'Road to neste mesterskap kobles inn'},
 {name:'Paavo Nurmi Games',place:'Turku, Finland',country:'FIN',cat:'A',events:['100m','200m','400m','800m','1500m','5000m','110mH','100mH','400mH','3000mSC','HJ','PV','LJ','TJ','SP','DT','HT','JT'],date:'2027 – dato kommer',contact:'Arrangørkontakt kobles inn',prize:'Premiepenger kobles inn',history:'Historisk nivå kobles til tidligere resultatlister',road:'Road to neste mesterskap kobles inn'}
];
function normalizedEvent(code){return code==='Decathlon'?'Decathlon':code==='Heptathlon'?'Heptathlon':code;}
function render(){
 const host=document.getElementById('meetList'); if(!host)return;
 const code=normalizedEvent(document.getElementById('event')?.value||'');
 const matches=meetData.filter(m=>m.events.includes(code));
 const intro=`<div class="finder-summary"><div><span class="eyebrow">AKTUELLE STEVNER</span><h4>${eventLabel()}</h4><p class="muted">Stevner som arrangerer valgt øvelse. Første versjon viser strukturen; verifiserte stevnedata kobles inn neste.</p></div><div class="finder-count">${matches.length}<small>treff nå</small></div></div>`;
 const cards=matches.map(m=>`<article class="meet-card meet-card-v1"><div class="meet-top"><div><h4>${m.name}</h4><div class="meta">${m.place}</div></div><span class="cat">${m.cat}</span></div><div class="meet-facts"><div><span>Dato</span><strong>${m.date}</strong></div><div><span>Aktuell øvelse</span><strong>${eventLabel()}</strong></div><div><span>Kontakt</span><strong>${m.contact}</strong></div><div><span>Premiepenger</span><strong>${m.prize}</strong></div></div><div class="meet-insight"><span>Historisk nivå</span><strong>${m.history}</strong><small>Her skal vi vise f.eks. 1., 3., 5. og 8. plass fra tidligere utgaver.</small></div><div class="meet-insight road"><span>Road to …</span><strong>${m.road}</strong><small>Skal vise utøverens plassering mot siste kvalifiseringsplass.</small></div><div class="card-actions"><button type="button" onclick="alert('Kartfunksjonen kobles til når verifisert arena/adresse er på plass.')">Vis i kart</button><button type="button" onclick="alert('Detaljsiden får historiske resultater, kontakt, premier og rankingpotensial.')">Se stevnedetaljer</button></div></article>`).join('');
 host.innerHTML=intro+(cards||`<div class="finder-empty"><strong>Ingen stevner registrert for ${eventLabel()} ennå.</strong><p class="muted">Dette betyr ikke at det ikke finnes stevner. Den komplette stevnedatabasen kobles inn i neste steg.</p></div>`);
}
function install(){
 const panel=document.getElementById('meetList')?.closest('.panel');
 if(panel){const h=panel.querySelector('h3');if(h)h.textContent='Finn aktuelle rankingstevner';const m=panel.querySelector('.section-head>.muted');if(m)m.textContent='Basert på valgt øvelse';}
 document.getElementById('meetCategoryFilter')?.closest('.filters')?.setAttribute('style','display:none');
 document.getElementById('event')?.addEventListener('change',()=>setTimeout(render,0));
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();