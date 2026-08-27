// Rankingstevner v0.16.0 – kjønn velges før utøver, øvelse velges etterpå
(function(){
  'use strict';

  // A field label whose text just repeats the section's eyebrow (e.g. "Kjønn" under
  // "VELG KJØNN") is visual noise. Keep it for screen readers via aria-label, but hide the
  // visible text node so the <select>/<input> sits directly under the eyebrow.
  function hideRedundantLabelText(label,text){
    if(!label) return;
    label.setAttribute('aria-label',text);
    for(const node of Array.from(label.childNodes)){
      if(node.nodeType===Node.TEXT_NODE && node.textContent.trim()===text) node.remove();
    }
  }

  function applyLayout(){
    const sex=document.getElementById('sex');
    const eventSelect=document.getElementById('event');
    const profileBox=document.querySelector('.existing');
    const eventChoice=document.querySelector('.event-choice');
    if(!sex||!eventSelect||!profileBox||!eventChoice){setTimeout(applyLayout,100);return;}
    if(document.getElementById('sexChoiceBeforeAthlete')) return;

    const sexLabel=sex.closest('label');
    if(!sexLabel) return;

    // Keep exactly one label per section: the eyebrow. A single-field section doesn't need
    // its own field label repeating (near enough) the same word, so that text is hidden and
    // moved to aria-label for accessibility instead of shown twice.
    hideRedundantLabelText(sexLabel,'Kjønn');

    const sexSection=document.createElement('div');
    sexSection.id='sexChoiceBeforeAthlete';
    sexSection.style.cssText='margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid #d9e5e1;max-width:280px';
    sexSection.innerHTML='<span class="eyebrow">VELG KJØNN</span><div style="margin-top:9px"></div>';
    sexSection.querySelector('div').appendChild(sexLabel);
    profileBox.parentNode.insertBefore(sexSection,profileBox);

    // Drop the h4 entirely instead of renaming it to "Velg øvelse" - identical text to the
    // "VELG ØVELSE" eyebrow right above it.
    eventChoice.querySelector('h4')?.remove();
    eventChoice.querySelector('.eyebrow')?.replaceChildren(document.createTextNode('VELG ØVELSE'));
    hideRedundantLabelText(eventSelect.closest('label'),'Øvelse');

    // "Finn utøver" repeated the "UTØVERPROFIL" eyebrow right above it in different words.
    profileBox.querySelector('h4')?.remove();

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
