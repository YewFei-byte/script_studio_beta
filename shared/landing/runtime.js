// The small script shipped inside every rendered landing page (as a string).
// - EN / 中文 switch: swaps every [data-en] element's text, and WhatsApp
//   links' pre-typed message, remembers the choice.
// - Mobile menu toggle.
// - Header turns solid once you scroll (IntersectionObserver on a sentinel,
//   no scroll listeners).
// - Sections fade up as they come into view (skipped for reduced motion,
//   handled in CSS).
// - Clicks on [data-track] are reported to window.SS_TRACK_URL if set
//   (the hosted page sets it, for view / WhatsApp-click counts).
// In the editor (<html class="editing">) language and reveal are driven by
// the editor instead.

export const RUNTIME_JS = `(function(){
var d=document,root=d.documentElement,editing=root.classList.contains('editing');
root.classList.add('js');
function setLang(l){
  d.querySelectorAll('[data-en]').forEach(function(el){
    if(el.isContentEditable)return;
    var v=el.getAttribute('data-'+l)||el.getAttribute('data-en');
    if(v!==null)el.textContent=v;
  });
  d.querySelectorAll('[data-wa-en]').forEach(function(a){a.href=a.getAttribute('data-wa-'+l)||a.getAttribute('data-wa-en');});
  d.querySelectorAll('.lang button').forEach(function(b){var on=b.getAttribute('data-lang')===l;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  root.lang=l==='zh'?'zh-Hans':'en';
  root.setAttribute('data-lang',l);
}
window.SS_setLang=setLang;
d.querySelectorAll('.lang button').forEach(function(b){b.addEventListener('click',function(){var l=b.getAttribute('data-lang');setLang(l);try{localStorage.setItem('ss-lang',l)}catch(e){}});});
if(!editing&&d.querySelector('.lang')){
  var saved=null;try{saved=localStorage.getItem('ss-lang')}catch(e){}
  var pref=saved||((navigator.language||'').toLowerCase().indexOf('zh')===0?'zh':null);
  if(pref&&pref!==root.getAttribute('data-lang'))setLang(pref);
}
var burger=d.querySelector('.burger'),mnav=d.querySelector('.mnav');
if(burger&&mnav){
  burger.addEventListener('click',function(){var o=mnav.classList.toggle('open');burger.setAttribute('aria-expanded',o?'true':'false');});
  mnav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){mnav.classList.remove('open');burger.setAttribute('aria-expanded','false');});});
}
var hdr=d.querySelector('.hdr'),sentinel=d.getElementById('top');
if('IntersectionObserver' in window){
  if(hdr&&sentinel)new IntersectionObserver(function(e){hdr.classList.toggle('scrolled',!e[0].isIntersecting);}).observe(sentinel);
  if(!editing){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
    d.querySelectorAll('.rv').forEach(function(el){io.observe(el);});
  }
}else{d.querySelectorAll('.rv').forEach(function(el){el.classList.add('in');});}
if(window.SS_TRACK_URL&&!editing){
  var hit=function(e){try{navigator.sendBeacon(window.SS_TRACK_URL+'?e='+e)}catch(x){}};
  hit('view');
  d.addEventListener('click',function(ev){var t=ev.target.closest&&ev.target.closest('[data-track]');if(t)hit(t.getAttribute('data-track'));});
}
})();`;
