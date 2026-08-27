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
    const profileCompact=document.querySelector('.profile-compact');
    if(!sex||!eventSelect||!profileBox||!eventChoice||!profileCompact){setTimeout(applyLayout,100);return;}
    if(sex.dataset.profileRowApplied) return;
    sex.dataset.profileRowApplied='1';

    const sexLabel=sex.closest('label');
    if(!sexLabel) return;

    // Kjønn is an athlete-profile field just like Navn/WA-ID, so it joins their row and
    // gets a matching visible "Kjønn" label - putting it in its own boxed section made its
    // select float above the Navn/WA-ID inputs instead of sitting level with them.
    if(!document.getElementById('profileCompactWithSexStyle')){
      const style=document.createElement('style');
      style.id='profileCompactWithSexStyle';
      style.textContent='.profile-compact{grid-template-columns:120px minmax(0,1.2fr) minmax(0,1fr) auto}@media(max-width:760px){.profile-compact{grid-template-columns:1fr!important}}';
      document.head.appendChild(style);
    }
    profileCompact.insertBefore(sexLabel,profileCompact.firstChild);

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

  // Vindstatus mangekamp is the only field in its grid row - three empty columns next to
  // it. Move "Beregn rankingeffekt" in there for combined events instead of giving it a
  // whole separate row below.
  function installRankingActionInline(){
    const rankingAction=document.querySelector('.ranking-action');
    const combinedWindSection=document.getElementById('combinedWindSection');
    const eventSelect=document.getElementById('event');
    if(!rankingAction||!combinedWindSection||!eventSelect){setTimeout(installRankingActionInline,100);return;}
    if(rankingAction.dataset.inlineWindInstalled) return;
    rankingAction.dataset.inlineWindInstalled='1';

    const homeParent=rankingAction.parentNode;
    const homeNext=rankingAction.nextSibling;
    const windLabel=combinedWindSection.querySelector('label');

    // Vindstatus mangekamp's column starts with a label line ("Vindstatus mangekamp") before
    // its select - the button has no such line above it, so without a matching spacer it
    // sits higher than the select and throws the whole row out of alignment.
    let spacer=rankingAction.querySelector('.ranking-action-spacer');
    if(!spacer){
      spacer=document.createElement('div');
      spacer.className='ranking-action-spacer';
      spacer.setAttribute('aria-hidden','true');
      spacer.style.cssText='display:none;font-size:13px;font-weight:700;line-height:1.2;visibility:hidden;margin-bottom:7px';
      spacer.textContent='.';
      rankingAction.insertBefore(spacer,rankingAction.firstChild);
    }

    // The "WA trekker 24 poeng …" <small> renders smaller than the "Resultatet sammenlignes
    // …" span (browser default <small> shrink stacks on top of the label's own font-size) -
    // match them so the two captions read as the same size.
    if(!document.getElementById('combinedWindRowStyle')){
      const style=document.createElement('style');
      style.id='combinedWindRowStyle';
      style.textContent='#combinedWindSection label small{font-size:13px;font-weight:400}';
      document.head.appendChild(style);
    }

    function place(){
      if(combinedWindSection.style.display!=='none'){
        rankingAction.style.marginTop='0';
        rankingAction.style.gridColumn='span 2';
        // Stack button-then-caption, matching the Vindstatus select-then-<small> column next
        // to it, so "Resultatet sammenlignes …" lines up beside "WA trekker 24 poeng …"
        // instead of trailing the button on the same line. Stretch (rather than left-align)
        // so the button matches the select's full-width sizing - same size boxes.
        rankingAction.style.flexDirection='column';
        rankingAction.style.alignItems='stretch';
        rankingAction.style.gap='5px';
        spacer.style.display='block';
        if(windLabel) windLabel.style.gridColumn='span 2';
        combinedWindSection.appendChild(rankingAction);
      }else{
        rankingAction.style.marginTop='18px';
        rankingAction.style.gridColumn='';
        rankingAction.style.flexDirection='';
        rankingAction.style.alignItems='';
        rankingAction.style.gap='';
        spacer.style.display='none';
        if(windLabel) windLabel.style.gridColumn='';
        homeParent.insertBefore(rankingAction,homeNext);
      }
    }
    eventSelect.addEventListener('change',()=>setTimeout(place,60));
    place();
    setTimeout(place,500);
  }
  installRankingActionInline();

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyLayout,{once:true});
  else applyLayout();
})();
