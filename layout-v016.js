// Rankingstevner v0.16.0 – kjønn velges før utøver, øvelse velges etterpå
(function(){
  'use strict';

  function applyLayout(){
    const sex=document.getElementById('sex');
    const eventSelect=document.getElementById('event');
    const profileBox=document.querySelector('.existing');
    const eventChoice=document.querySelector('.event-choice');
    if(!sex||!eventSelect||!profileBox||!eventChoice){setTimeout(applyLayout,100);return;}
    if(document.getElementById('sexChoiceBeforeAthlete')) return;

    const sexLabel=sex.closest('label');
    if(!sexLabel) return;

    const sexSection=document.createElement('div');
    sexSection.id='sexChoiceBeforeAthlete';
    sexSection.style.cssText='margin:0 0 18px;padding-bottom:18px;border-bottom:1px solid #d9e5e1;max-width:280px';
    sexSection.innerHTML='<span class="eyebrow">VELG KJØNN</span><div style="margin-top:9px"></div>';
    sexSection.querySelector('div').appendChild(sexLabel);
    profileBox.parentNode.insertBefore(sexSection,profileBox);

    const heading=eventChoice.querySelector('h4');
    if(heading) heading.textContent='Velg øvelse';
    eventChoice.querySelector('.eyebrow')?.replaceChildren(document.createTextNode('VELG ØVELSE'));

    const grid=eventChoice.querySelector('.grid');
    if(grid){
      grid.style.gridTemplateColumns='minmax(220px,280px)';
      grid.style.maxWidth='280px';
    }

    const eventLabel=eventSelect.closest('label');
    if(eventLabel) eventLabel.style.width='100%';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyLayout,{once:true});
  else applyLayout();
})();
