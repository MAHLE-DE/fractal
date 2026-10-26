(function(){
  'use strict';
  const engines = { canopy: LayoutCanopy, legacy: LegacyFractalLayout, growth: LayoutCandidates['adaptive-growth'], envelope: LayoutCandidates['branch-envelope'] };
  let selected = 'canopy'; window.FractalLayout = class { build(root) { return new engines[selected]().build(root); } };
  const ready = () => {
    if (!window.FractalWorkspace?.ready) { setTimeout(ready, 60); return; }
    document.title = 'Fractal · Read-only layout comparison';
    const actions = document.querySelector('.header-actions'), controls = document.createElement('div'); controls.className = 'test-layout-controls';
    controls.innerHTML = '<span>LAYOUT TEST</span>' + Object.entries({canopy:'Canopy',legacy:'Original',growth:'Growth',envelope:'Envelope'}).map(([id,label]) => '<button class="button subtle" data-test-engine="'+id+'" aria-pressed="'+(id===selected)+'">'+label+'</button>').join(''); actions.prepend(controls);
    document.querySelector('.demo-badge').textContent = 'Read-only test';
    document.querySelector('.session-state small').textContent = 'Canopy · visual comparison';
    document.querySelector('.statusbar>span:last-child').textContent = 'HTML LAYOUT TEST';
    controls.addEventListener('click', e => { const button = e.target.closest('[data-test-engine]'); if (!button) return; selected=button.dataset.testEngine; controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', b===button)); FractalWorkspace.state.selected=null; FractalWorkspace.renderView(); });
    FractalWorkspace.renderView();
  }; ready();
})();
